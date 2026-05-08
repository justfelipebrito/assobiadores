export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  href: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const TERMS_PAGE: LegalPageContent = {
  href: '/termos-de-uso',
  title: 'Termos de uso',
  description:
    'Regras gerais para uso do assobiador.com, participação em batalhas, classificatórias, destaques diários e rankings.',
  updatedAt: '08/05/2026',
  sections: [
    {
      title: 'Aceitação dos termos',
      paragraphs: [
        'Ao criar uma conta, acessar ou usar o assobiador.com, você concorda com estes Termos de uso e com as regras específicas de cada competição, batalha, classificatória ou destaque diário.',
        'Se você não concordar com estes termos, não utilize a plataforma.',
      ],
    },
    {
      title: 'Conta e responsabilidade do usuário',
      paragraphs: [
        'Você é responsável por manter seus dados corretos, proteger suas credenciais e usar a plataforma de forma honesta.',
        'CPF, telefone, endereço e Chave Pix podem ser exigidos para validar participação em competições oficiais, pagamentos e prêmios.',
      ],
      bullets: [
        'O nome de usuário deve ser único e não pode violar direitos de terceiros.',
        'Você não deve tentar manipular votos, pagamentos, rankings ou resultados.',
        'Você não deve se passar por outra pessoa ou criar contas para burlar regras.',
      ],
    },
    {
      title: 'Conteúdo enviado',
      paragraphs: [
        'Batalhas e Destaques Diários usam áudio gravado na própria plataforma, com limite de até 2 minutos, salvo regra específica publicada pela plataforma.',
        'Ao enviar conteúdo, você declara que tem direito de publicá-lo e autoriza o assobiador.com a exibi-lo dentro da plataforma para votação, moderação, rankings, histórico e divulgação do próprio serviço.',
      ],
      bullets: [
        'Não envie conteúdo ofensivo, discriminatório, fraudulento, ilegal ou que viole direitos de terceiros.',
        'A plataforma pode remover conteúdo, suspender contas ou invalidar participações que violem as regras.',
      ],
    },
    {
      title: 'Batalhas, classificatórias e campeonatos',
      paragraphs: [
        'Cada formato pode ter regras próprias de inscrição, pagamento, envio, votação, desempate, classificação, pontuação e premiação.',
        'Pagamentos confirmados, pontuações, resultados, prêmios e rankings são processados por fluxos confiáveis da plataforma. A interface pode orientar o usuário, mas a validação final ocorre no servidor.',
      ],
      bullets: [
        'Participantes não podem votar na própria batalha quando essa regra se aplicar.',
        'Classificatórias e competições oficiais podem exigir pagamento e dados oficiais do perfil.',
        'Resultados podem ser recalculados ou corrigidos se houver erro técnico, fraude ou violação de regra.',
      ],
    },
    {
      title: 'Pagamentos e prêmios',
      paragraphs: [
        'Pagamentos podem ser processados por provedores externos, como Mercado Pago. A confirmação de participação depende da confirmação do pagamento pelo provedor e pela plataforma.',
        'Prêmios dependem das regras do evento. Para eventos pagos, taxas de plataforma e distribuição de prêmio devem seguir a regra exibida no momento da inscrição.',
      ],
    },
    {
      title: 'Disponibilidade e alterações',
      paragraphs: [
        'A plataforma pode sofrer manutenções, instabilidades ou alterações de funcionalidades. Podemos atualizar estes termos, regras de produto e fluxos operacionais para melhorar segurança, clareza e sustentabilidade do serviço.',
        'Mudanças relevantes poderão ser comunicadas dentro da plataforma ou por canais de contato disponíveis.',
      ],
    },
    {
      title: 'Contato',
      paragraphs: [
        'Para dúvidas sobre estes Termos de uso, privacidade, pagamentos, moderação ou conta, entre em contato pelos canais oficiais informados na plataforma.',
      ],
    },
  ],
};

export const PRIVACY_PAGE: LegalPageContent = {
  href: '/privacidade',
  title: 'Privacidade',
  description:
    'Como o assobiador.com coleta, usa, protege e compartilha dados pessoais necessários para conta, competições, pagamentos, rankings e segurança.',
  updatedAt: '08/05/2026',
  sections: [
    {
      title: 'Dados que coletamos',
      paragraphs: [
        'Coletamos os dados necessários para criar conta, operar a plataforma, validar competições, processar pagamentos, pagar prêmios, prevenir fraude e melhorar o produto.',
      ],
      bullets: [
        'Dados públicos de perfil: nome de exibição, nome de usuário, foto, naturalidade, ranking e histórico público de pontuação.',
        'Dados privados: e-mail, CPF, telefone, Chave Pix e endereço quando necessários para validação, pagamentos e prêmios.',
        'Dados de uso: páginas acessadas, ações na plataforma, votos, inscrições, envios, pagamentos e registros técnicos.',
        'Conteúdo enviado: áudios gravados na plataforma e metadados associados.',
      ],
    },
    {
      title: 'Como usamos os dados',
      paragraphs: [
        'Usamos seus dados para entregar a experiência principal do assobiador.com: conta, batalhas, destaques diários, classificatórias, campeonatos, rankings, pagamentos, prêmios, suporte e segurança.',
      ],
      bullets: [
        'Validar identidade e elegibilidade para competições oficiais.',
        'Processar inscrições pagas e confirmar participações.',
        'Calcular pontos, rankings, resultados e histórico público.',
        'Detectar abuso, fraude, manipulação de votos e violações das regras.',
        'Medir uso do produto com ferramentas de analytics.',
      ],
    },
    {
      title: 'Dados públicos e dados privados',
      paragraphs: [
        'Alguns dados são exibidos publicamente para que rankings, perfis, votos e competições funcionem. Dados sensíveis, como CPF, telefone, Chave Pix e endereço, não devem aparecer em páginas públicas.',
        'A plataforma separa dados públicos de perfil e dados privados de identidade, contato e pagamento para reduzir exposição indevida.',
      ],
    },
    {
      title: 'Compartilhamento com terceiros',
      paragraphs: [
        'Podemos compartilhar dados com provedores necessários para operar a plataforma, sempre de acordo com a finalidade do serviço.',
      ],
      bullets: [
        'Firebase/Google Cloud para autenticação, banco de dados, hospedagem, funções, armazenamento e logs.',
        'Mercado Pago para processamento e confirmação de pagamentos.',
        'Google Analytics e Google AdSense para métricas, publicidade e monetização, quando habilitados.',
      ],
    },
    {
      title: 'Cookies, analytics e anúncios',
      paragraphs: [
        'Podemos usar cookies, identificadores e tecnologias similares para manter sessão, medir audiência, entender navegação, melhorar o produto e exibir anúncios.',
        'Ferramentas de terceiros podem aplicar suas próprias políticas de privacidade e controles de consentimento quando exigidos.',
      ],
    },
    {
      title: 'Segurança e retenção',
      paragraphs: [
        'Aplicamos controles técnicos e organizacionais para proteger dados e limitar acesso a informações sensíveis. Nenhum sistema é totalmente imune a riscos, mas trabalhamos para reduzir exposição e abuso.',
        'Mantemos dados pelo tempo necessário para operar a conta, cumprir obrigações legais, resolver disputas, prevenir fraude e preservar histórico de competições e rankings.',
      ],
    },
    {
      title: 'Seus direitos',
      paragraphs: [
        'Você pode solicitar acesso, correção, exclusão, portabilidade ou revisão do uso dos seus dados, conforme aplicável pela legislação brasileira de proteção de dados.',
        'Alguns dados podem precisar ser mantidos por obrigação legal, segurança, auditoria, pagamentos, prevenção de fraude ou integridade de competições.',
      ],
    },
    {
      title: 'Contato',
      paragraphs: [
        'Para solicitações sobre privacidade e dados pessoais, use os canais oficiais informados na plataforma.',
      ],
    },
  ],
};

export const LEGAL_PAGES = {
  terms: TERMS_PAGE,
  privacy: PRIVACY_PAGE,
} as const;
