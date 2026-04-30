
import OpenAI from 'openai';

async function test() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('Testing API Key:', apiKey?.slice(0, 10) + '...');
  
  const openai = new OpenAI({ apiKey });
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 5
    });
    console.log('Success:', res.choices[0]?.message.content);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
