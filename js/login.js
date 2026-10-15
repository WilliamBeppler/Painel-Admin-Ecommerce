const formLogin = document.getElementById('form-login');
const btnEntrar = document.getElementById('btn-entrar');
const mensagem = document.getElementById('mensagem');

// Já é admin logado? Vai direto para o painel.
usuarioAtual().then(usuario => {
    if (usuario && usuario.role === 'ADMIN') window.location.replace('index.html');
});

formLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;

    if (!email || !senha) {
        mostrarMensagem(mensagem, 'Preencha e-mail e senha.', 'erro');
        return;
    }

    btnEntrar.disabled = true;
    mostrarMensagem(mensagem, 'Entrando...');

    try {
        const resposta = await chamarApi('/usuarios/login', {
            method: 'POST',
            body: JSON.stringify({ email, senha })
        });

        if (!resposta.ok) {
            mostrarMensagem(mensagem, await resposta.text() || 'Não foi possível entrar.', 'erro');
            return;
        }

        // O login criou o cookie; o /me confirma que o navegador guardou e diz o cargo
        const usuario = await usuarioAtual();

        if (!usuario) {
            console.error('Login aceito, mas o cookie não voltou no /me. Abra o painel por http://localhost:5501 (não 127.0.0.1).');
            mostrarMensagem(mensagem, 'Não foi possível iniciar a sessão neste navegador.', 'erro');
            return;
        }

        // Só UX: quem barra de verdade é o hasRole("ADMIN") no servidor
        if (usuario.role !== 'ADMIN') {
            mostrarMensagem(mensagem, 'Esta conta não é administradora.', 'erro');
            return;
        }

        window.location.replace('index.html');
    } catch (erro) {
        console.error('Erro no login:', erro);
        mostrarMensagem(mensagem, 'Erro de conexão com o servidor.', 'erro');
    } finally {
        btnEntrar.disabled = false;
    }
});
