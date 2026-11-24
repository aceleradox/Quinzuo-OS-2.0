# Quinzuo OS 2.0

Uma aplicação web construída em Node.js que simula um ambiente de sistema operacional, contando com persistência de dados local via SQLite (`vhd.sqlite`) e ferramentas integradas.

## 🚀 Funcionalidades

- **Interface Web (Web OS):** Frontend servido a partir da pasta `public/` simulando a experiência de um sistema operacional no navegador.
- **Disco Rígido Virtual (VHD):** Armazenamento e persistência de estado/arquivos utilizando um banco de dados SQLite local (`vhd.sqlite`).
- **Ferramentas e Utilitários:** Módulos e scripts auxiliares organizados nos diretórios `tools/` e `flops/`.

## 🛠️ Tecnologias Utilizadas

- **Backend:** Node.js (`server.js`)
- **Banco de Dados:** SQLite (`vhd.sqlite`)
- **Frontend:** HTML, CSS e JavaScript (`public/`)
- *(Adicione aqui outras bibliotecas presentes no seu `package.json`, como Express, Socket.io, etc.)*

## 📂 Estrutura do Projeto

```text
Quinzuo-OS-2.0/
├── flops/              # [Descreva brevemente o propósito desta pasta]
├── public/             # Arquivos estáticos do frontend (HTML, CSS, JS, assets)
├── tools/              # Ferramentas e utilitários internos do sistema
├── package.json        # Dependências e scripts do projeto
├── package-lock.json   # Controle de versão exata das dependências
├── server.js           # Ponto de entrada e servidor principal da aplicação
└── vhd.sqlite          # Banco de dados SQLite funcionando como disco virtual
```

## ⚙️ Como Executar Localmente

### Pré-requisitos

Certifique-se de ter o [Node.js](https://nodejs.org) instalado em sua máquina.

### Passo a passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com
   cd Quinzuo-OS-2.0
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor:**
   ```bash
   node server.js
   ```
   *(Ou utilize `npm start`, caso tenha configurado o script no `package.json`)*

4. **Acesse no navegador:**
   Abra `http://localhost:3000` *(ajuste a porta conforme configurado no seu `server.js`)*.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir uma *issue* para relatar bugs ou enviar um *pull request* com melhorias.

## 📄 Licença

Este projeto está sob a licença [MIT](LICENSE) *(altere caso utilize outra licença)*.
