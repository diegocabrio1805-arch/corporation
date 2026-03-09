import pandas as pd
import sys

file_path = r'C:\Users\DANIEL\Desktop\CARPETA PARA APLICACIONES\prueba de excel.xlsx'
try:
    df = pd.read_excel(file_path, header=None)
    # Find headers - searching first row or any row with text
    header_found = False
    for i in range(min(10, len(df))): # check first 10 rows
        row = df.iloc[i].astype(str).tolist()
        if any('NOMBRE' in s.upper() or 'CLIENTE' in s.upper() or 'CEDULA' in s.upper() for s in row):
            print(f"Header Row found at index {i}")
            print("Headers:")
            for header in df.iloc[i]:
                if pd.notna(header):
                    print(f"- {header}")
            header_found = True
            break
    if not header_found:
        print("No header row found with keywords. Showing first row headers:")
        for header in df.iloc[0]:
            if pd.notna(header):
                print(f"- {header}")
except Exception as e:
    print(f"Error: {e}")
