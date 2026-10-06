#!/usr/bin/env python3
"""在仓库中运行，打包可离线阅读和运行的 6 个学习文件。"""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parent
names = ["learning-guide.md", "complete-handbook.md", "mini_harness.py", "test_mini_harness.py", "fine_tune_and_distill.py", "test_training.py"]
destination = root / "workshop-materials.zip"
for name in names:
    if not (root / name).is_file():
        raise SystemExit(f"缺少文件：{name}；请先生成完整讲义")
with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
    for name in names:
        # 固定 ZIP 时间戳与顺序，未修改材料时可重建相同归档。
        info = ZipInfo(f"model-workshop/{name}", date_time=(2026, 10, 5, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (root / name).read_bytes())
print(f"已打包 {len(names)} 个文件：{destination}（{destination.stat().st_size} 字节）")
