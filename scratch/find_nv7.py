import os

dir_path = r"C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest\scripts\robustez"
for root, dirs, files in os.walk(dir_path):
    for file in files:
        if file.endswith(".py"):
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    for line_num, line in enumerate(f, 1):
                        if "nv7" in line.lower():
                            print(f"{file} [L{line_num}]: {line.strip()}")
            except Exception as e:
                pass
