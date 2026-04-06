#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

ROOT = Path("/Users/ko/Documents/GitHub/CompusAss")
SRC_MD = ROOT / "论文.md"
OUT_MD = ROOT / "论文.with-images.md"
FIG_DIR = ROOT / "figs_mermaid"

FIG_DIR.mkdir(parents=True, exist_ok=True)

text = SRC_MD.read_text(encoding="utf-8")

pattern = re.compile(r"```mermaid\s*\n(.*?)\n```", re.DOTALL)
matches = list(pattern.finditer(text))

new_text = text
offset = 0

for i, m in enumerate(matches, start=1):
    mermaid_code = m.group(1).strip() + "\n"
    mmd_file = FIG_DIR / f"fig_{i:02d}.mmd"
    png_file = FIG_DIR / f"fig_{i:02d}.png"

    mmd_file.write_text(mermaid_code, encoding="utf-8")

    cmd = [
        "npx", "-y", "@mermaid-js/mermaid-cli",
        "-i", str(mmd_file),
        "-o", str(png_file),
        "-b", "white",
        "-s", "2"
    ]
    subprocess.run(cmd, check=True)

    replacement = f"![流程图{i}](./figs_mermaid/{png_file.name})"
    start = m.start() + offset
    end = m.end() + offset
    new_text = new_text[:start] + replacement + new_text[end:]
    offset += len(replacement) - (m.end() - m.start())

OUT_MD.write_text(new_text, encoding="utf-8")

print(f"已生成: {OUT_MD}")
print(f"图片目录: {FIG_DIR}")