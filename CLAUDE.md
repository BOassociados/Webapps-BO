# Webapps-BO — notas para o Claude

Hub de ferramentas internas da BO Associados, publicado no GitHub Pages a partir de `main`.
Tudo é mudado por pull request, que o utilizador aprova.

## Estrutura

- `index.html` — hub, com cartões por categoria (Geral, Estruturas, Geotecnia, Instalações Hidráulicas).
- `ferramentas/<pasta>/index.html` — uma pasta por ferramenta, com o link `← Voltar às ferramentas` para `../../index.html`.
- `tema.js` — tema claro/escuro partilhado (chave `bo-tema`). Cada ferramenta inclui `../../tema.js` no `<head>` e usa `<button type="button" data-tema-toggle></button>`.
- `versoes.js` — versões das ferramentas (ver abaixo).

Cor de destaque da BO: `#7EA4A2` no tema escuro e `#4b7a77` no claro (variável `--blue`, apesar do nome). Não usar azul.

## Versões — atualizar em TODOS os pull requests que alterem uma ferramenta

Em `versoes.js`, acrescentar uma linha no início da lista dessa ferramenta: `{ v, data, nota }`.

- `vX.Y`: X muda com alterações profundas (novas funcionalidades ou mudanças nos cálculos), e Y volta a 0. Y soma 1 por cada pull request com pequenas alterações.
- `data`: dia em que o pull request é aprovado (AAAA-MM-DD). Usar a data do dia em que se abre o PR, e corrigir se for aprovado noutro dia.
- `nota`: uma frase curta, em português.
- Ferramenta nova: entrada `1.0` com a nota "Versão inicial", e cartão novo no `index.html`.

O hub mostra a versão nos cartões automaticamente (a chave é o nome da pasta). A Sapatas lê a mesma versão para o rodapé e para a memória de cálculo.

Se um pull request já tiver sido aprovado, as alterações seguintes vão num pull request novo.
