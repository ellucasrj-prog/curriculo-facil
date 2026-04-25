// api/gerar-curriculo.js
// Vercel Serverless Function (Node.js 18+)

export default async function handler(req, res) {
  // CORS — útil em testes e não atrapalha em produção
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  // Garante que a chave existe antes de tentar chamar a API
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('DEEPSEEK_API_KEY não configurada');
    return res.status(500).json({ 
      erro: 'Servidor não configurado. Faltando DEEPSEEK_API_KEY nas variáveis de ambiente.' 
    });
  }

  // Vercel já parseia req.body quando Content-Type é application/json
  const { nome, resumo, experiencias, formacao } = req.body || {};

  if (!nome || !experiencias) {
    return res.status(400).json({ erro: 'Nome e experiências são obrigatórios.' });
  }

  const prompt = `Você é um redator profissional de currículos no Brasil. Transforme as informações abaixo em um currículo pronto, com linguagem simples, clara e profissional.

DADOS DO CANDIDATO:
Nome: ${nome}
Resumo informado: ${resumo || '(não informado)'}
Experiências: ${experiencias}
Formação: ${formacao || '(não informada)'}

REGRAS:
- Comece com o nome em destaque (linha própria, em maiúsculas).
- Crie um RESUMO PROFISSIONAL de 2 a 3 linhas no topo, mesmo que o candidato não tenha dado um resumo bom — deduza pelas experiências.
- Organize em seções com títulos em MAIÚSCULAS: RESUMO PROFISSIONAL, EXPERIÊNCIA PROFISSIONAL, FORMAÇÃO, HABILIDADES.
- Use bullets com "•" e verbos de ação no passado ("Atendi", "Organizei", "Recebi", etc.).
- Se a pessoa não citou habilidades, deduza 4 a 6 habilidades a partir das experiências.
- Não invente datas, empresas ou cursos que não foram mencionados.
- Tom formal mas acessível. Sem emojis. Sem markdown. Apenas texto puro.`;

  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const erroTexto = await response.text();
      console.error('DeepSeek retornou erro:', response.status, erroTexto);
      return res.status(502).json({ 
        erro: `API DeepSeek falhou (${response.status}). Verifique sua chave e saldo.` 
      });
    }

    const data = await response.json();
    const conteudo = data?.choices?.[0]?.message?.content;

    if (!conteudo) {
      console.error('Resposta inesperada da DeepSeek:', JSON.stringify(data));
      return res.status(502).json({ erro: 'Resposta vazia da IA.' });
    }

    return res.status(200).json({ curriculo: conteudo });

  } catch (error) {
    console.error('Erro ao chamar DeepSeek:', error);
    return res.status(500).json({ 
      erro: 'Falha de conexão com a IA. Tente novamente em instantes.' 
    });
  }
}
