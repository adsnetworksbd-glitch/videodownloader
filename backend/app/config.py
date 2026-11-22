from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Download Gateway"
    database_url: str = "sqlite+aiosqlite:///./gateway.db"
    admin_token: str = "change-me-local"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    provider_default_timeout: int = 30
    max_provider_attempts: int = 5
    chunk_size: int = 64 * 1024
    download_dir: str = "./downloads"
    video_concurrent_downloads: int = 2
    ytdlp_format: str = "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[ext=mp4][height<=1080]/best"
    rate_limit_requests: int = 60
    rate_limit_window: int = 60
    free_daily_limit: int = 100
    pro_daily_limit: int = 1000
    free_playlist_items: int = 10
    telegram_bot_token: str = ""
    admin_email: str = ""
    admin_password: str = ""
    telegram_alert_chat_id: str = ""
    pro_instant_activation: int = 1


    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            text = value.strip().strip("[]")
            origins = []
            for part in text.split(","):
                origin = part.strip().strip("\"'").strip()
                if origin:
                    origins.append(origin)
            return origins
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
