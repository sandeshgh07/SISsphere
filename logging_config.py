import logging
import logging.config
import sys

def configure_logging():
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
            }
        },
        "handlers": {
            "stdout": {
                "class": "logging.StreamHandler",
                "stream": sys.stdout,
                "formatter": "json"
            }
        },
        "root": {
            "level": "INFO",
            "handlers": ["stdout"]
        }
    })

print("🔥 LOGGING CONFIGURED FROM:", __file__)
