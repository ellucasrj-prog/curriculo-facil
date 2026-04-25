// api/gerar-curriculo.js
// Vercel Serverless Function (Node.js 18+)
// Retorna JSON estruturado com seções separadas para o frontend renderizar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido. Use POST.' });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ 
      erro: 'Servidor não configurado. Faltando DEEPSEEK_API_KEY.' 
    });
  }

  const { nome, contato, cidade, resumo, experiencias, formacao } = req.body || {};

  if (!nome || !experiencias) {
    return res.status(400).json({ erro: 'Nome e experiências são obrigatórios.' });
  }

  const prompt = `Você é um redator profissional de currículos no Brasil. Vou te dar dados do candidato e você vai me devolver um JSON ESTRITAMENTE no formato abaixo, sem nenhum texto antes ou depois, sem markdown, sem \`\`\`json.

DADOS DO CANDIDATO:
Nome: ${nome}
Contato: ${contato || '(não informado)'}
Cidade: ${cidade || '(não informada)'}
Sobre: ${resumo || '(não informado)'}
Experiências: ${experiencias}
Formação: ${formacao || '(não informada)'}

FORMATO DE SAÍDA (JSON puro, exatamente este formato):
{
  "nome": "nome completo em maiúsculas",
  "titulo": "cargo/função principal em uma linha curta, ex: 'Atendente de comércio'",
  "contato": "${contato || ''}",
  "cidade": "${cidade || ''}",
  "resumo": "Resumo profissional de 2 a 3 linhas. Mesmo se a pessoa não tiver dado um resumo bom, deduza pelas experiências.",
  "experiencia": "Texto formatado das experiências profissionais. Cada empresa deve aparecer assim:\\n\\nNome da Empresa (período)\\n• Bullet com verbo de ação no passado\\n• Outro bullet\\n\\nDeixe uma linha em branco entre cada empresa. Se a pessoa não informou período/duração de alguma, escreva apenas o nome sem parênteses.",
  "formacao": "Cada formação em uma linha. Ex:\\nEnsino Médio Completo\\nCurso Técnico em Informática",
  "habilidades": "Lista de 5 a 8 habilidades, uma por linha, começando com bullet •. Deduza a partir das experiências se não foram informadas explicitamente."
}

REGRAS IMPORTANTES:
- NUNCA invente datas, empresas, cursos ou cargos que não foram mencionados.
- Se a pessoa só disse "trabalhei na padaria por 5 anos", coloque "Padaria (5 anos)" — não invente o nome.
- Use verbos de ação no passado: Atendi, Organizei, Operei, Recebi, Auxiliei, Realizei.
- Tom profissional mas acessível. Sem floreios.
- A resposta DEVE começar com { e terminar com }. Nada mais.`;

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
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const erroTexto = await response.text();
      console.error('DeepSeek erro:', response.status, erroTexto);
      return res.status(502).json({ 
        erro: `API DeepSeek falhou (${response.status}).` 
      });
    }

    const data = await response.json();
    const conteudo = data?.choices?.[0]?.message?.content;

    if (!conteudo) {
      return res.status(502).json({ erro: 'Resposta vazia da IA.' });
    }

    // Tenta parsear como JSON
    let curriculoEstruturado;
    try {
      // Remove possíveis ```json ou ``` que escapem do response_format
      const limpo = conteudo.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      curriculoEstruturado = JSON.parse(limpo);
    } catch (e) {
      console.error('Erro ao parsear JSON da IA:', conteudo);
      return res.status(502).json({ 
        erro: 'IA retornou formato inválido. Tente novamente.' 
      });
    }

    return res.status(200).json({ curriculo: curriculoEstruturado });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ 
      erro: 'Falha de conexão com a IA.' 
    });
  }
}
