import streamlit as st

st.set_page_config(page_title="RTP - Gestor de Notas", layout="wide")

# Cargar el HTML completo
with open("notas.html", "r", encoding="utf-8") as f:
    html_content = f.read()

st.components.v1.html(html_content, height=1200, scrolling=True)