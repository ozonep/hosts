from __future__ import annotations

import argparse
from pathlib import Path
from urllib.request import urlopen

DEFAULT_SOURCE_URL = "https://schakal.ru/hosts/alive_hosts_ru_com.txt"
DEFAULT_OUTPUT_PATH = Path("hosts")
FETCH_TIMEOUT_SECONDS = 30


def normalize_hostname(hostname: str) -> str:
    if hostname.endswith("."):
        hostname = hostname[:-1]
    return hostname.lower()


def filter_hosts(source_text: str) -> str:
    output_lines: list[str] = []
    for raw_line in source_text.splitlines():
        # Preserve metadata and blank-line structure while normalizing kept host lines.
        if raw_line.startswith("!"):
            output_lines.append(raw_line)
            continue
        if not raw_line.strip():
            output_lines.append("")
            continue

        parts = raw_line.split()
        if len(parts) < 2:
            continue

        hostname = parts[-1]
        normalized = normalize_hostname(hostname)
        if normalized.endswith(".ru") or normalized.endswith(".net"):
            output_lines.append(raw_line.rstrip())

    return "\n".join(output_lines) + "\n"


def _read_source_text(input_path: Path | None) -> str:
    if input_path is not None:
        return input_path.read_text(encoding="utf-8")

    with urlopen(DEFAULT_SOURCE_URL, timeout=FETCH_TIMEOUT_SECONDS) as response:
        return response.read().decode("utf-8")


def _write_output(output_path: Path, content: str) -> None:
    with output_path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Filter hosts entries to .ru and .net domains.")
    parser.add_argument("--input", type=Path, help="Read source text from a local file instead of downloading.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help="Write the filtered hosts file to this path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_text = _read_source_text(args.input)
    filtered_text = filter_hosts(source_text)
    _write_output(args.output, filtered_text)


if __name__ == "__main__":
    main()
