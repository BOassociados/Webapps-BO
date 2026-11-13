/* ==========================================================================
   BO Associados — versões das ferramentas
   --------------------------------------------------------------------------
   Fonte única das versões mostradas nos cartões do hub.
   A chave é o nome da pasta em ferramentas/<pasta>/.

   Regra de numeração  vX.Y
     X — alteração profunda: novas funcionalidades ou mudanças nos cálculos
         (Y volta a 0)
     Y — pequenas alterações (correções, aspeto, comodidades), +1 por pull request
   data — dia em que o pull request dessa versão foi aprovado (AAAA-MM-DD)

   Em cada pull request que altere uma ferramenta: acrescentar uma linha
   no início do "historico" dessa ferramenta. A primeira linha é a atual.
   ========================================================================== */
window.BO_VERSOES = {

  'corretor-dwfx': [
    { v: '1.2', data: '2026-11-13', nota: 'Largar o ficheiro em qualquer ponto da página' },
    { v: '1.1', data: '2026-10-31', nota: 'Tema claro / escuro partilhado com o hub' },
    { v: '1.0', data: '2026-09-02', nota: 'Versão inicial' }
  ],

  'termo-responsabilidade': [
    { v: '1.3', data: '2026-10-31', nota: 'Tema claro / escuro partilhado com o hub' },
    { v: '1.2', data: '2026-09-09', nota: 'Ajustes' },
    { v: '1.1', data: '2026-09-07', nota: 'Modelo Word atualizado' },
    { v: '1.0', data: '2026-09-04', nota: 'Versão inicial' }
  ],

  'conversor-markdown': [
    { v: '1.1', data: '2026-11-13', nota: 'Largar ficheiros em qualquer ponto da página' },
    { v: '1.0', data: '2026-11-09', nota: 'Versão inicial' }
  ],

  'lista-desenhos': [
    { v: '1.2', data: '2026-11-13', nota: 'Largar o ficheiro em qualquer ponto da página' },
    { v: '1.1', data: '2026-11-13', nota: 'Cores da BO no tema escuro' },
    { v: '1.0', data: '2026-11-13', nota: 'Versão inicial' }
  ],

  'sapatas': [
    { v: '2.0', data: '2026-11-02', nota: 'Cálculo revisto: drenado / não drenado por camada, espaçamentos e amarrações pelo EC2; campos do Projeto e rodapé' },
    { v: '1.1', data: '2026-10-31', nota: 'Tema claro / escuro partilhado com o hub' },
    { v: '1.0', data: '2026-10-31', nota: 'Versão inicial' }
  ]

};
