import streamlit as st

st.set_page_config(page_title="RTP - Gestor de Notas", layout="wide")

# Crear pestañas o navegación
tab1, tab2 = st.tabs(["📝 Gestor de Notas", "🔄 Convertidor"])

with tab1:
    with open("notas.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    st.components.v1.html(html_content, height=1200, scrolling=True)

with tab2:
    with open("convertidor.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    st.components.v1.html(html_content, height=1200, scrolling=True)