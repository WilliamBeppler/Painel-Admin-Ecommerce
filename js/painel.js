// Tudo que exibe dado de produto usa createElement + textContent. Nenhum innerHTML.
const listaProdutos = document.getElementById('lista-produtos');
const resumoProdutos = document.getElementById('resumo-produtos');
const mensagemLista = document.getElementById('mensagem-lista');

// --- PORTEIRO DO PAINEL (só UX: a proteção real é o hasRole("ADMIN") no servidor) ---
async function iniciarPainel() {
    const usuario = await usuarioAtual();

    if (!usuario || usuario.role !== 'ADMIN') {
        window.location.replace('login.html');
        return;
    }

    document.getElementById('nome-admin').textContent = usuario.nome;
    document.body.classList.remove('verificando');

    await carregarProdutos();
}

/**
 * Trata as respostas que não deram certo. Devolve a mensagem a exibir.
 * 401 = sessão acabou: volta para o login.
 */
async function lerFalha(resposta) {
    if (resposta.status === 401) {
        window.location.replace('login.html');
        return 'Sessão encerrada. Faça login novamente.';
    }
    const texto = await resposta.text();
    if (resposta.status === 403) {
        return texto || 'Sem permissão para esta ação.';
    }
    return texto || `Erro inesperado (${resposta.status}).`;
}

// --- LISTAGEM ---
async function carregarProdutos() {
    mostrarMensagem(mensagemLista, 'Carregando produtos...');

    let produtos;
    try {
        const resposta = await chamarApi('/produtos/admin');
        if (!resposta.ok) {
            mostrarMensagem(mensagemLista, await lerFalha(resposta), 'erro');
            return;
        }
        produtos = await resposta.json();
    } catch (erro) {
        console.error('Erro ao listar produtos:', erro);
        mostrarMensagem(mensagemLista, 'Não foi possível falar com o servidor.', 'erro');
        return;
    }

    // Ativos primeiro, depois por nome
    produtos.sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'));

    const ativos = produtos.filter(p => p.ativo).length;
    resumoProdutos.textContent = `${ativos} à venda · ${produtos.length - ativos} desativado(s)`;

    mostrarMensagem(mensagemLista, produtos.length === 0 ? 'Nenhum produto cadastrado ainda.' : '');
    listaProdutos.replaceChildren(...produtos.map(criarLinhaProduto));
}

function criarCampo(rotulo, input) {
    const campo = document.createElement('div');
    campo.className = 'campo';
    const label = document.createElement('label');
    label.textContent = rotulo;
    label.htmlFor = input.id;
    campo.append(label, input);
    return campo;
}

function criarInput(id, tipo, valor, atributos = {}) {
    const input = document.createElement('input');
    input.id = id;
    input.type = tipo;
    input.value = valor; // .value é texto puro, não HTML
    Object.entries(atributos).forEach(([nome, v]) => input.setAttribute(nome, v));
    return input;
}

function criarBotao(texto, classe, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao ' + classe;
    botao.textContent = texto;
    botao.addEventListener('click', aoClicar);
    return botao;
}

// Só põe o src se o endereço for confiável; senão remove (src="" faria o navegador
// requisitar a própria página do painel).
function definirImagem(img, caminho) {
    const url = urlDaImagem(caminho);
    if (url) img.src = url;
    else img.removeAttribute('src');
}

function criarLinhaProduto(produto) {
    const linha = document.createElement('article');
    linha.className = 'produto' + (produto.ativo ? '' : ' produto-inativo');

    // Miniatura
    const miniatura = document.createElement('img');
    miniatura.className = 'produto-miniatura';
    miniatura.alt = produto.nome;
    definirImagem(miniatura, produto.caminho_imagem);

    // Cabeçalho: nome + status
    const cabecalho = document.createElement('div');
    cabecalho.className = 'produto-cabecalho';
    const titulo = document.createElement('h3');
    titulo.textContent = produto.nome;
    const status = document.createElement('span');
    status.className = 'status ' + (produto.ativo ? 'status-ativo' : 'status-inativo');
    status.textContent = produto.ativo ? 'À venda' : 'Desativado';
    const precoAtual = document.createElement('span');
    precoAtual.className = 'produto-preco';
    precoAtual.textContent = formatarPreco(produto.preco);
    cabecalho.append(titulo, status, precoAtual);

    // Campos de edição
    const prefixo = `produto-${produto.id}`;
    const inputNome = criarInput(`${prefixo}-nome`, 'text', produto.nome, { maxlength: '100' });
    const inputPreco = criarInput(`${prefixo}-preco`, 'number', Number(produto.preco).toFixed(2),
        { min: '0.01', step: '0.01', inputmode: 'decimal' });
    const inputImagem = criarInput(`${prefixo}-imagem`, 'text', produto.caminho_imagem, { maxlength: '255' });

    inputImagem.addEventListener('input', () => definirImagem(miniatura, inputImagem.value));

    const campos = document.createElement('div');
    campos.className = 'produto-campos';
    campos.append(
        criarCampo('Nome', inputNome),
        criarCampo('Preço (R$)', inputPreco),
        criarCampo('Imagem', inputImagem)
    );
    campos.lastChild.classList.add('campo-largo');

    // Ações
    const mensagem = document.createElement('p');
    mensagem.className = 'mensagem';
    mensagem.setAttribute('role', 'status');

    const acoes = document.createElement('div');
    acoes.className = 'produto-acoes';

    const btnSalvar = criarBotao('Salvar alterações', 'botao-principal', () =>
        salvarProduto(produto.id, inputNome, inputPreco, inputImagem, mensagem, btnSalvar));

    const btnStatus = produto.ativo
        ? criarBotao('Apagar', 'botao-perigo', () => desativarProduto(produto, mensagem))
        : criarBotao('Reativar', 'botao-secundario', () => reativarProduto(produto, mensagem));

    acoes.append(btnSalvar, btnStatus, mensagem);

    const corpo = document.createElement('div');
    corpo.className = 'produto-corpo';
    corpo.append(cabecalho, campos, acoes);

    linha.append(miniatura, corpo);
    return linha;
}

// --- AÇÕES ---

/** Lê e confere os campos antes de mandar (o servidor confere de novo). */
function lerFormulario(inputNome, inputPreco, inputImagem) {
    const nome = inputNome.value.trim();
    const preco = Number(inputPreco.value);
    const caminhoImagem = inputImagem.value.trim();

    if (!nome) return { erro: 'Informe o nome do produto.' };
    if (!inputPreco.value || !Number.isFinite(preco) || preco <= 0) {
        return { erro: 'O preço deve ser maior que zero.' };
    }
    if (!caminhoImagem) return { erro: 'Informe a imagem do produto.' };

    return { dados: { nome, preco, caminhoImagem } };
}

async function salvarProduto(id, inputNome, inputPreco, inputImagem, mensagem, botao) {
    const { dados, erro } = lerFormulario(inputNome, inputPreco, inputImagem);
    if (erro) {
        mostrarMensagem(mensagem, erro, 'erro');
        return;
    }

    botao.disabled = true;
    mostrarMensagem(mensagem, 'Salvando...');

    try {
        // O id vai SÓ na URL; o corpo tem apenas nome, preço e imagem
        const resposta = await chamarApi(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
        if (!resposta.ok) {
            mostrarMensagem(mensagem, await lerFalha(resposta), 'erro');
            return;
        }
        await carregarProdutos();
        mostrarMensagem(mensagemLista, `"${dados.nome}" foi atualizado.`, 'sucesso');
    } catch (falha) {
        console.error('Erro ao salvar:', falha);
        mostrarMensagem(mensagem, 'Não foi possível falar com o servidor.', 'erro');
    } finally {
        botao.disabled = false;
    }
}

async function desativarProduto(produto, mensagem) {
    // confirm() mostra texto puro: o nome não é interpretado como HTML
    const confirmou = confirm(
        `Apagar "${produto.nome}" da loja?\n\n` +
        'Ele deixa de aparecer na vitrine. Os pedidos antigos continuam intactos ' +
        'e você pode reativar o produto depois.'
    );
    if (!confirmou) return;

    await mudarStatus(`/produtos/${produto.id}`, 'DELETE', mensagem, `"${produto.nome}" foi apagado da loja.`);
}

async function reativarProduto(produto, mensagem) {
    await mudarStatus(`/produtos/${produto.id}/ativar`, 'PUT', mensagem, `"${produto.nome}" voltou para a loja.`);
}

async function mudarStatus(caminho, metodo, mensagem, textoSucesso) {
    mostrarMensagem(mensagem, 'Aguarde...');
    try {
        const resposta = await chamarApi(caminho, { method: metodo });
        if (!resposta.ok) {
            mostrarMensagem(mensagem, await lerFalha(resposta), 'erro');
            return;
        }
        await carregarProdutos();
        mostrarMensagem(mensagemLista, textoSucesso, 'sucesso');
    } catch (falha) {
        console.error('Erro ao mudar status:', falha);
        mostrarMensagem(mensagem, 'Não foi possível falar com o servidor.', 'erro');
    }
}

// --- CADASTRO ---
const formCadastro = document.getElementById('form-cadastro');
const novoNome = document.getElementById('novo-nome');
const novoPreco = document.getElementById('novo-preco');
const novoImagem = document.getElementById('novo-imagem');
const novoPrevia = document.getElementById('novo-previa');
const mensagemCadastro = document.getElementById('mensagem-cadastro');
const btnCadastrar = document.getElementById('btn-cadastrar');

novoImagem.addEventListener('input', () => {
    const url = urlDaImagem(novoImagem.value);
    novoPrevia.hidden = !url;
    if (url) novoPrevia.src = url;
});

formCadastro.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const { dados, erro } = lerFormulario(novoNome, novoPreco, novoImagem);
    if (erro) {
        mostrarMensagem(mensagemCadastro, erro, 'erro');
        return;
    }

    btnCadastrar.disabled = true;
    mostrarMensagem(mensagemCadastro, 'Cadastrando...');

    try {
        const resposta = await chamarApi('/produtos', { method: 'POST', body: JSON.stringify(dados) });
        if (!resposta.ok) {
            mostrarMensagem(mensagemCadastro, await lerFalha(resposta), 'erro');
            return;
        }
        formCadastro.reset();
        novoPrevia.hidden = true;
        mostrarMensagem(mensagemCadastro, `"${dados.nome}" foi cadastrado.`, 'sucesso');
        await carregarProdutos();
    } catch (falha) {
        console.error('Erro ao cadastrar:', falha);
        mostrarMensagem(mensagemCadastro, 'Não foi possível falar com o servidor.', 'erro');
    } finally {
        btnCadastrar.disabled = false;
    }
});

document.getElementById('btn-sair').addEventListener('click', sair);

iniciarPainel();
