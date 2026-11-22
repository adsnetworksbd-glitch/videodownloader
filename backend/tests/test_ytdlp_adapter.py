"""Tests for the yt-dlp adapter and /api/info (extraction is mocked)."""
import httpx
import pytest

from app.models import Provider
from app.providers import VideoResolutionError
from app.providers import ytdlp as ytdlp_mod
from app.routers.videos import _subtitle_tracks
from app.providers.ytdlp import YtDlpAdapter, pick_entry, sanitize_filename, summarize

FAKE_INFO = {
    "title": 'My Video: "Test" Episode 1 <HD>',
    "uploader": "Channel One",
    "duration": 95,
    "thumbnail": "https://img.example.com/thumb.jpg",
    "extractor_key": "Youtube",
    "webpage_url": "https://www.youtube.com/watch?v=abc",
    "ext": "mp4",
    "filesize": 1234567,
    "url": "https://media.example.com/file.mp4",
}

PLAYLIST_INFO = {
    "_type": "playlist",
    "entries": [dict(FAKE_INFO), dict(FAKE_INFO)],
}


def make_provider(**overrides) -> Provider:
    fields = dict(name="ytdlp-main", adapter="ytdlp", base_url="", priority=1, timeout_seconds=5)
    fields.update(overrides)
    return Provider(**fields)


def test_sanitize_filename_removes_unsafe_characters():
    assert sanitize_filename('My Video: "Test"/Ep <HD>') == "My Video TestEp HD"
    assert sanitize_filename("///") == "video"
    assert len(sanitize_filename("x" * 500)) == 150


def test_pick_entry_returns_first_of_playlist():
    assert pick_entry(PLAYLIST_INFO)["url"] == FAKE_INFO["url"]
    assert pick_entry(FAKE_INFO) is FAKE_INFO
    with pytest.raises(VideoResolutionError):
        pick_entry({"entries": [None, {"title": "no url"}]})


def test_summarize_shapes_info():
    summary = summarize(PLAYLIST_INFO)
    assert summary["platform"] == "Youtube"
    assert summary["title"].startswith("My Video")
    assert summary["duration"] == 95


async def test_adapter_open_resolves_and_sets_metadata():
    adapter = YtDlpAdapter(make_provider())

    def fake_extract(url, timeout, fmt=None):
        return dict(FAKE_INFO)

    original = ytdlp_mod.extract_info_sync
    ytdlp_mod.extract_info_sync = fake_extract
    try:
        meta = await adapter.open("https://www.youtube.com/watch?v=abc", httpx.AsyncClient())
    finally:
        ytdlp_mod.extract_info_sync = original

    assert adapter._media_url == FAKE_INFO["url"]
    assert adapter._filename == "My Video Test Episode 1 HD.mp4"
    assert meta.content_type == "video/mp4"
    assert meta.content_length == 1234567


async def test_adapter_open_wraps_unknown_errors():
    adapter = YtDlpAdapter(make_provider())

    def boom(url, timeout, fmt=None):
        raise RuntimeError("network exploded")

    original = ytdlp_mod.extract_info_sync
    ytdlp_mod.extract_info_sync = boom
    try:
        with pytest.raises(VideoResolutionError):
            await adapter.open("https://www.youtube.com/watch?v=abc", httpx.AsyncClient())
    finally:
        ytdlp_mod.extract_info_sync = original


async def test_adapter_stream_downloads_from_media_url():
    adapter = YtDlpAdapter(make_provider())
    adapter._media_url = "https://media.example.com/file.mp4"

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        async def aiter_bytes(self):
            yield b"chunk-one-"
            yield b"chunk-two"

        async def aclose(self):
            self.closed = True

    class FakeClient:
        def build_request(self, method, url, headers=None, timeout=None):
            return httpx.Request(method, url, headers=headers)

        async def send(self, request, *, stream=False, **kwargs):
            return FakeResponse()

    chunks = [chunk async for chunk in adapter.stream(FakeClient())]
    assert b"".join(chunks) == b"chunk-one-chunk-two"


async def test_info_endpoint(client, monkeypatch):
    def run_extract(url, timeout, fmt=None):
        return dict(FAKE_INFO)

    monkeypatch.setattr("app.routers.videos.extract_info_sync", run_extract)

    response = await client.get("/api/info?url=https://www.youtube.com/watch?v=abc")
    assert response.status_code == 200
    body = response.json()
    assert body["platform"] == "Youtube"
    assert body["ext"] == "mp4"

    bad = await client.get("/api/info?url=not-a-url")
    assert bad.status_code == 422


def _formats_info() -> dict:
    return {
        "title": "Direct Test Video",
        "extractor_key": "Youtube",
        "ext": "mp4",
        "url": "https://media.example.com/progressive.mp4",
        "formats": [
            {
                "format_id": "dash-video-1080",
                "ext": "mp4",
                "url": "https://media.example.com/video-1080-only.mp4",
                "height": 1080,
                "vcodec": "avc1.640028",
                "acodec": "none",
                "filesize": 90_000_000,
            },
            {
                "format_id": "dash-audio",
                "ext": "m4a",
                "url": "https://media.example.com/audio-only.m4a",
                "vcodec": "none",
                "acodec": "mp4a.40.2",
                "abr": 128,
                "filesize": 4_000_000,
            },
            {
                "format_id": "18",
                "ext": "mp4",
                "url": "https://media.example.com/progressive-360.mp4",
                "height": 360,
                "vcodec": "avc1.42001E",
                "acodec": "mp4a.40.2",
                "filesize": 10_000_000,
            },
            {
                "format_id": "22",
                "ext": "mp4",
                "url": "https://media.example.com/progressive-720.mp4",
                "height": 720,
                "vcodec": "avc1.64001F",
                "acodec": "mp4a.40.2",
                "filesize": 30_000_000,
            },
        ],
    }


def _patch_extract(monkeypatch, info: dict) -> None:
    def run_extract(url, timeout, fmt=None):
        return info

    monkeypatch.setattr("app.routers.videos.extract_info_sync", run_extract)


async def test_direct_link_returns_progressive_format(client, monkeypatch):
    _patch_extract(monkeypatch, _formats_info())

    response = await client.get(
        "/api/info/direct?url=https://www.youtube.com/watch?v=abc&quality=720p"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["direct"] is True
    assert body["url"] == "https://media.example.com/progressive-720.mp4"
    assert body["quality"] == "720p"
    assert body["ext"] == "mp4"
    assert body["filename"] == "Direct Test Video.mp4"


async def test_direct_link_never_exceeds_requested_height(client, monkeypatch):
    _patch_extract(monkeypatch, _formats_info())

    response = await client.get(
        "/api/info/direct?url=https://www.youtube.com/watch?v=abc&quality=480p"
    )
    assert response.status_code == 200
    assert response.json()["url"] == "https://media.example.com/progressive-360.mp4"


async def test_direct_link_audio_uses_best_audio_track(client, monkeypatch):
    _patch_extract(monkeypatch, _formats_info())

    response = await client.get(
        "/api/info/direct?url=https://www.youtube.com/watch?v=abc&quality=audio"
    )
    assert response.status_code == 200
    body = response.json()
    assert body["url"] == "https://media.example.com/audio-only.m4a"
    assert body["quality"] == "audio"
    assert body["ext"] == "m4a"


async def test_direct_link_falls_back_to_server_when_dash_only(client, monkeypatch):
    dash_only = _formats_info()
    dash_only["formats"] = [
        fmt
        for fmt in dash_only["formats"]
        if fmt["format_id"] in ("dash-video-1080", "dash-audio")
    ]
    _patch_extract(monkeypatch, dash_only)

    response = await client.get(
        "/api/info/direct?url=https://www.youtube.com/watch?v=abc&quality=1080p"
    )
    assert response.status_code == 404
    assert "no direct format" in response.json()["detail"]


def test_subtitle_tracks_prefers_vtt_and_language():
    entry = dict(
        FAKE_INFO,
        subtitles={
            "hi": [{"ext": "ttml", "url": "https://s.example/hi.ttml"}],
            "en": [
                {"ext": "srv3", "url": "https://s.example/en.srv3"},
                {"ext": "vtt", "url": "https://s.example/en.vtt"},
            ],
            "junk": [{"ext": "json3", "url": "https://s.example/junk.json3"}],
        },
    )
    tracks = _subtitle_tracks(entry)
    assert [t["lang"] for t in tracks] == ["en", "hi"]
    assert tracks[0]["ext"] == "vtt"
    assert tracks[0]["url"] == "https://s.example/en.vtt"


async def test_info_includes_subtitles(client, monkeypatch):
    info = dict(FAKE_INFO, subtitles={"en": [{"ext": "vtt", "url": "https://s.example/en.vtt"}]})
    _patch_extract(monkeypatch, info)

    response = await client.get("/api/info?url=https://www.youtube.com/watch?v=abc")
    assert response.status_code == 200
    assert response.json()["subtitles"] == [
        {"lang": "en", "ext": "vtt", "url": "https://s.example/en.vtt"}
    ]


async def test_direct_link_best_quality(client, monkeypatch):
    _patch_extract(monkeypatch, _formats_info())

    response = await client.get("/api/info/direct?url=https://www.youtube.com/watch?v=abc")
    assert response.status_code == 200
    assert response.json()["url"] == "https://media.example.com/progressive-720.mp4"
