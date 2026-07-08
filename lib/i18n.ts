// i18n leve — dicionário para as superfícies públicas (landing + auth).
// Estruturado para acrescentar línguas: basta juntar outra chave a `dict`.

export type Locale = "pt" | "en";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "pt", label: "PT" },
  { code: "en", label: "EN" },
];

const pt = {
  nav: { how: "Como funciona", safeguards: "Salvaguardas", security: "Segurança", educators: "Para docentes", signin: "Entrar", start: "Começar", panel: "O meu painel" },
  hero: {
    kicker: "Avaliação com IA · validação humana",
    h1a: "A primeira passagem é automática.",
    h1b: "O juízo continua humano.",
    lead: "A Avalia avalia os trabalhos contra a tua rubrica em minutos e encaminha cada resultado por revisão do docente e salvaguardas de integridade — feedback mais rápido sem nunca abdicar do critério.",
    start: "Começar",
    how: "Ver como funciona",
    sub: "Genérico para qualquer cadeira — tu defines a rubrica.",
  },
  mock: {
    title: "AED · Trabalho 3", sub: "Submissão 14 / 32",
    aiScore: "Nota da IA · a aguardar revisão", awaiting: "A aguardar o docente",
    c1: "Tese & argumento", c2: "Evidência & fontes", c3: "Estrutura & clareza", c4: "Mecânica",
    feedbackLabel: "Feedback rascunhado",
    feedback: "Tese forte e bem enquadrada. Aperta o terceiro parágrafo — a afirmação ultrapassa a evidência. Cita a fonte primária diretamente.",
    approve: "Aprovar & publicar", adjust: "Ajustar",
    integrity: "Verificação de integridade limpa · originalidade dentro do esperado",
  },
  how: {
    kicker: "Como funciona", title: "O docente nunca sai do ciclo.",
    p1t: "Alinha à tua rubrica", p1d: "Importa uma rubrica ou cria uma na Avalia. Cada nota mapeia para um critério que definiste — nada é caixa preta.",
    p2t: "A IA rascunha notas & feedback", p2d: "Cada submissão é avaliada critério a critério, com nota provisória, justificação legível e comentários — mais um sinal de integridade, nunca uma acusação.",
    p3t: "Revisão e publicação pelo docente", p3d: "O docente confirma, ajusta ou sobrepõe numa fila rápida. Nada chega ao aluno sem um humano assinar por baixo.",
    rubricTitle: "Rubrica · AED Trabalho 3", criteria: "4 critérios", imported: "Rubrica importada ✓",
    drafting: "IA a rascunhar…", draftScore: "Nota rascunhada",
    published: "Publicado ao aluno", finalScore: "Nota final · confirmada pela Prof. Ramos",
    editedFeedbackLabel: "Feedback · ligeiramente editado pelo docente",
    editedFeedback: "Tese forte e bem enquadrada. Aperta o terceiro parágrafo — e passa no meu horário de atendimento sobre a fonte. Bom progresso.",
    approvedReleased: "Aprovado & publicado ✓", audit: "Assinatura humana registada · auditoria guardada",
  },
  features: {
    kicker: "O que recebes", title: "Feito para a realidade de uma carga de avaliação real.",
    items: [
      ["§", "Notas ancoradas na rubrica", "Cada ponto está ligado a um critério que escreveste, com uma justificação que podes ler e editar."],
      ["⌘", "Fila com o docente no ciclo", "Aprova numa tecla, ajusta em segundos. Trata os fáceis em lote, abranda nos que precisam de ti."],
      ["≈", "Feedback consistente e explicável", "O mesmo critério na submissão um e na duzentos — com comentários acionáveis para o aluno."],
      ["◇", "Sinais de integridade, não veredictos", "As flags dão contexto ao docente para pesar — a Avalia nunca decide sozinha sobre má conduta."],
      ["⇄", "Integração com o LMS", "Moodle e afins. Notas e comentários sincronizam para onde o aluno já olha."],
      ["▤", "Análises de departamento", "Tempo de resposta, distribuição de notas e taxas de ajuste — visão sem vigiar o docente."],
    ],
  },
  safeguards: {
    kicker: "Integridade académica",
    title: "Salvaguardas desenhadas por quem já esteve em conselhos de integridade.",
    lead: "A forma mais rápida de perder a confiança do corpo docente é deixar um modelo decidir quem copiou. A Avalia é construída ao contrário: informa o docente e fica fora do veredicto.",
    items: [
      ["Sem decisões autónomas", "Cada nota e cada flag exige confirmação humana antes de contar."],
      ["Transparência total", "Alunos e docentes veem que a IA ajudou, e qual foi a justificação."],
      ["Monitorização de viés", "A avaliação é auditada para padrões díspares entre turmas e cohortes."],
      ["Caminho de recurso claro", "Cada resultado traz o registo que o aluno precisa para o contestar — e um humano para responder."],
    ],
  },
  educators: {
    kicker: "Para quem é", title: "Uma plataforma, quatro pontos de vista.",
    items: [
      ["Docentes", "Recupera as tuas noites. Avalia uma pilha inteira numa fração do tempo, com a palavra final em cada nota."],
      ["Direção & compras", "Um processo defensável e auditável, com tratamento de dados alinhado e controlos institucionais claros."],
      ["Alunos", "Feedback mais rápido e consistente, revisto por um humano, com um caminho transparente para questionar."],
      ["Design instrucional", "Rubricas baseadas em padrões, adoção nativa no LMS e análises que respeitam a autonomia do docente."],
    ],
  },
  security: {
    kicker: "Segurança & conformidade", title: "Dados dos alunos tratados como o registo que são.",
    lead: "A Avalia é construída para requisitos institucionais desde o dia um — e nunca treina modelos com o trabalho dos teus alunos.",
    items: [
      "Tratamento de dados alinhado com a proteção de dados",
      "Sem treino de modelos sobre os trabalhos dos alunos",
      "SSO & acesso por papel",
      "Encriptação em trânsito e em repouso",
      "Registo de auditoria completo por nota",
    ],
  },
  quote: { text: "“Construímos a Avalia sobre uma convicção simples: a automação deve dar aos docentes mais tempo para o juízo — nunca menos.”", author: "A equipa Avalia" },
  cta: { title: "Vê a Avalia avaliar um trabalho real.", lead: "Traz uma das tuas rubricas. Avaliamos uma pilha de exemplo ao vivo — e ficas com a palavra final.", start: "Começar agora", have: "Já tenho conta" },
  footer: { tagline: "Avaliação com IA e validação humana, para o ensino superior.", product: "Produto", account: "Conta", signin: "Entrar", signup: "Criar conta", student: "Área do aluno", copyright: "© 2026 Avalia. Todos os direitos reservados." },
  auth: {
    signin: "Entrar", signup: "Criar conta",
    welcomeTitle: "Bem-vindo de volta", welcomeSub: "Entra para continuar a rever as tuas avaliações.",
    createTitle: "Cria a tua conta", createSub: "Configura em menos de um minuto — sem cartão.",
    name: "Nome completo", namePh: "Prof. Elena Ramos",
    email: "Email institucional", emailPh: "tu@universidade.pt",
    password: "Password",
    signinBtn: "Entrar", signupBtn: "Criar conta",
    signinPending: "A entrar…", signupPending: "A criar conta…",
    switchToUpQ: "Novo na Avalia?", switchToUp: "Criar conta",
    switchToInQ: "Já tens conta?", switchToIn: "Entrar",
    errEmail: "Já existe uma conta com esse email.",
    errFields: "Preenche todos os campos (password com 6+ caracteres).",
    errCreds: "Email ou password incorretos.",
    eyebrow: "Avaliação com IA · validação humana",
    quote: "“A primeira passagem é automática. O juízo continua humano.”",
    badges: ["Avaliação por rubrica", "Revisão humana", "Sinais anti-IA"],
  },
};

const en: typeof pt = {
  nav: { how: "How it works", safeguards: "Safeguards", security: "Security", educators: "For educators", signin: "Sign in", start: "Get started", panel: "My dashboard" },
  hero: {
    kicker: "AI-assisted grading · human oversight",
    h1a: "The first pass is automated.",
    h1b: "The judgment stays human.",
    lead: "Avalia scores student work against your rubric in minutes, then routes every result through faculty review and academic-integrity safeguards — so feedback arrives faster without ever surrendering the standard.",
    start: "Get started",
    how: "See how it works",
    sub: "Works for any course — you define the rubric.",
  },
  mock: {
    title: "ENG 210 · Essay 3", sub: "Submission 14 / 32",
    aiScore: "AI-drafted score · pending review", awaiting: "Awaiting faculty",
    c1: "Thesis & argument", c2: "Evidence & sourcing", c3: "Structure & clarity", c4: "Mechanics",
    feedbackLabel: "Drafted feedback",
    feedback: "Strong, well-framed thesis. Tighten the third body paragraph — the claim outruns its evidence. Cite the primary source directly.",
    approve: "Approve & release", adjust: "Adjust",
    integrity: "Integrity check clear · originality within expected range",
  },
  how: {
    kicker: "How it works", title: "The instructor is never removed from the loop.",
    p1t: "Align to your rubric", p1d: "Import an existing rubric or build one in Avalia. Every score maps to a criterion you defined — nothing is a black box.",
    p2t: "AI drafts scores & feedback", p2d: "Each submission is evaluated criterion by criterion, with a draft grade, a readable rationale and comments — plus an integrity signal, never an accusation.",
    p3t: "Faculty review & release", p3d: "Instructors confirm, adjust or override in a fast review queue. Nothing reaches a student until a human signs off.",
    rubricTitle: "Rubric · ENG 210 Essay 3", criteria: "4 criteria", imported: "Rubric imported ✓",
    drafting: "AI drafting…", draftScore: "AI-drafted score",
    published: "Released to student", finalScore: "Final score · confirmed by Dr. Ramos",
    editedFeedbackLabel: "Feedback · lightly edited by instructor",
    editedFeedback: "Strong, well-framed thesis. Tighten the third body paragraph — and see me in office hours about your source. Nice progress.",
    approvedReleased: "Approved & released ✓", audit: "Human sign-off recorded · full audit trail saved",
  },
  features: {
    kicker: "What you get", title: "Built for the realities of a full grading load.",
    items: [
      ["§", "Rubric-native scoring", "Every point is tied to a criterion you wrote, with a rationale you can read and edit."],
      ["⌘", "Faculty-in-the-loop queue", "Approve in a keystroke, adjust in seconds. Batch the easy ones, slow down on the ones that need you."],
      ["≈", "Consistent, explainable feedback", "The same standard on submission one and submission two hundred — with comments students can act on."],
      ["◇", "Integrity signals, not verdicts", "Flags surface context for the instructor to weigh — Avalia never renders a misconduct judgment on its own."],
      ["⇄", "LMS integration", "Canvas, Blackboard, Moodle and D2L. Grades and comments sync back where students already look."],
      ["▤", "Department analytics", "Turnaround time, grade distributions and override rates — visibility without surveilling faculty."],
    ],
  },
  safeguards: {
    kicker: "Academic integrity",
    title: "Safeguards designed by people who have sat on integrity boards.",
    lead: "The fastest way to lose faculty trust is to let a model decide who cheated. Avalia is built the opposite way: it informs the instructor and stays out of the verdict.",
    items: [
      ["No autonomous decisions", "Every grade and every flag requires human confirmation before it counts."],
      ["Full transparency", "Students and faculty can see that AI assisted, and what the rationale was."],
      ["Bias monitoring", "Scoring is audited for disparate patterns across sections and cohorts."],
      ["A clear appeal path", "Every result carries the record a student needs to question it — and a human to answer."],
    ],
  },
  educators: {
    kicker: "Who it's for", title: "One platform, four points of view.",
    items: [
      ["Faculty & instructors", "Reclaim your evenings. Grade a full stack in a fraction of the time while keeping the final say on every mark."],
      ["Administrators & procurement", "A defensible, auditable process with compliant data handling and clear institutional controls."],
      ["Students", "Faster, more consistent feedback you can act on — reviewed by a human, with a transparent path to ask questions."],
      ["Instructional design & ed-tech", "Standards-based rubrics, LMS-native rollout and analytics that respect faculty autonomy."],
    ],
  },
  security: {
    kicker: "Security & compliance", title: "Student data treated like the record it is.",
    lead: "Avalia is built to meet institutional requirements from day one — and we never train models on your students' work.",
    items: [
      "Compliant, privacy-first data handling",
      "No training on student submissions",
      "SSO & role-based access",
      "Encryption in transit and at rest",
      "Full audit trail per grade",
    ],
  },
  quote: { text: "“We built Avalia on a simple conviction: automation should give faculty more time for judgment — never less of it.”", author: "The Avalia team" },
  cta: { title: "See Avalia grade a real assignment.", lead: "Bring one of your own rubrics. We'll grade a sample stack live — and you keep the final word.", start: "Get started", have: "I have an account" },
  footer: { tagline: "AI-assisted grading with human oversight, for higher education.", product: "Product", account: "Account", signin: "Sign in", signup: "Create account", student: "Student area", copyright: "© 2026 Avalia. All rights reserved." },
  auth: {
    signin: "Sign in", signup: "Create account",
    welcomeTitle: "Welcome back", welcomeSub: "Sign in to pick up your review queue.",
    createTitle: "Create your account", createSub: "Set up in under a minute — no card required.",
    name: "Full name", namePh: "Dr. Elena Ramos",
    email: "Institution email", emailPh: "you@university.edu",
    password: "Password",
    signinBtn: "Sign in", signupBtn: "Create account",
    signinPending: "Signing in…", signupPending: "Creating account…",
    switchToUpQ: "New to Avalia?", switchToUp: "Create an account",
    switchToInQ: "Already have an account?", switchToIn: "Sign in",
    errEmail: "An account with that email already exists.",
    errFields: "Fill in every field (password 6+ characters).",
    errCreds: "Wrong email or password.",
    eyebrow: "AI-assisted grading · human oversight",
    quote: "“The first pass is automated. The judgment stays human.”",
    badges: ["Rubric-based grading", "Human review", "Anti-AI signals"],
  },
};

export const dict = { pt, en };
export type Dict = typeof pt;
export function getDict(locale: Locale): Dict {
  return dict[locale] ?? dict.pt;
}
