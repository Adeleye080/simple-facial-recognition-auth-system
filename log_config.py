"""Logging Configuration."""

import logging


def setup_logging():
    """Configure log"""

    logging.basicConfig(
        level=logging.INFO,
        filename="app.log",
        filemode="a",
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
