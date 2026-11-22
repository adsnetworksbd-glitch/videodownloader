import ipaddress
import socket
from urllib.parse import urlparse


class UnsafeUrlError(ValueError):
    pass


BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal", "instance-data", "host.docker.internal"}


def _is_forbidden_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def assert_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError("only http(s) URLs are allowed")
    host = parsed.hostname
    if not host:
        raise UnsafeUrlError("URL has no host")
    hostname = host.lower().rstrip(".")
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith((".local", ".internal", ".lan", ".home")):
        raise UnsafeUrlError(f"host not allowed: {hostname}")
    if ipaddress_is_forbidden_literal(hostname):
        raise UnsafeUrlError("literal private or loopback IP addresses are not allowed")
    try:
        infos = socket.getaddrinfo(
            hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            proto=socket.IPPROTO_TCP,
        )
    except socket.gaierror:
        return url
    for info in infos:
        if _is_forbidden_ip(info[4][0]):
            raise UnsafeUrlError("host resolves to a private or reserved address")
    return url


def ipaddress_is_forbidden_literal(hostname: str) -> bool:
    return _is_forbidden_ip(hostname.strip("[]"))
