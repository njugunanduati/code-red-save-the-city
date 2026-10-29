import pytest
from app.main import configured_origins


def test_production_origins_accept_explicit_hosts():
    assert configured_origins(' https://game.vercel.app/,https://preview.example.com ') == [
        'https://game.vercel.app', 'https://preview.example.com']


@pytest.mark.parametrize('value', ['', '*', 'https://*.vercel.app', 'https://game.vercel.app/path', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com?any=1'])
def test_production_origins_reject_broad_or_invalid_values(value):
    with pytest.raises(ValueError):
        configured_origins(value)
