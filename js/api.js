// --- CONFIGURAÇÃO ---
const API = 'http://localhost:8080/api';

const LOJA_PAGINAS = 'http://localhost:5500/pages/';

/**
 * Toda chamada à API passa por aqui: sempre com credentials 'include',
 * para o navegador anexar o cookie HttpOnly da sessão.
 */
function chamarApi(caminho, opcoes = {}) {
    const cabecalhos = opcoes.body ? { 'Content-Type': 'application/json' } : {};
    return fetch(API + caminho, { ...opcoes, credentials: 'include', headers: cabecalhos });
}

/** Quem está logado: { id, nome, email, role } ou null. */
async function usuarioAtual() {
    try {
        const resposta = await chamarApi('/usuarios/me');
        return resposta.ok ? await resposta.json() : null;
    } catch (erro) {
        console.error('Não foi possível consultar a sessão:', erro);
        return null;
    }
}

async function sair() {
    try {
        await chamarApi('/usuarios/logout', { method: 'POST' });
    } catch (erro) {
        console.error('Não foi possível avisar o servidor do logout:', erro);
    }
    window.location.replace('login.html');
}

/**
 * Endereço completo de uma imagem para exibir no painel, ou '' se não for confiável.
 * Aceita só https:// ou arquivos servidos pela própria loja (o servidor valida de novo).
 */
function urlDaImagem(caminho) {
    if (!caminho) return '';
    try {
        const url = new URL(caminho.trim(), LOJA_PAGINAS);
        const daLoja = url.origin === new URL(LOJA_PAGINAS).origin;
        return (url.protocol === 'https:' || daLoja) ? url.href : '';
    } catch (erro) {
        return '';
    }
}

const formatoReal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatarPreco(valor) {
    return formatoReal.format(Number(valor));
}

/** Mostra uma mensagem num elemento (sempre como texto). tipo: 'sucesso' | 'erro' | '' */
function mostrarMensagem(elemento, texto, tipo = '') {
    elemento.textContent = texto;
    elemento.className = 'mensagem' + (tipo ? ' mensagem-' + tipo : '');
}
