import os
from pypdf import PdfReader

dir_path = r"C:\Users\Jesse\Desktop\QUANT TRADER\Prints quantminer"
files = [f for f in os.listdir(dir_path) if f.endswith('.pdf')]

print(f"Buscando texto em {len(files)} PDFs...")
for f in files:
    full_path = os.path.join(dir_path, f)
    try:
        reader = PdfReader(full_path)
        num_pages = len(reader.pages)
        print(f"\n=========================================")
        print(f"ARQUIVO: {f} ({num_pages} paginas)")
        print(f"=========================================")
        
        texto_encontrado = False
        for i in range(num_pages):
            text = reader.pages[i].extract_text()
            if text and text.strip():
                print(f"\n--- Pagina {i+1} ---")
                print(text[:2000]) # Imprime ate 2000 caracteres da pagina com texto
                texto_encontrado = True
                # Nao precisamos imprimir todas as paginas se forem muitas, vamos limitar
                if i >= 10:
                    print("... (limitado a 10 paginas de texto para nao lotar o log)")
                    break
        if not texto_encontrado:
            print("[Nenhum texto selecionavel encontrado neste PDF (provavelmente imagem/escaneado)]")
    except Exception as e:
        print(f"Erro ao ler {f}: {e}")
