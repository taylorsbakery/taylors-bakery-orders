export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { accountName, totalRevenue, totalOrders, avgOrderValue, lastOrderDate, topProducts, accountAge } = body;

    const prompt = `You are a commercial bakery CRM strategist for Taylor's Bakery in Indianapolis, Indiana. Your goal is to help the bakery deepen relationships with commercial accounts and increase order frequency.

Analyze this commercial customer account and generate creative, actionable engagement ideas:

**Account:** ${accountName}
**Lifetime Revenue:** $${totalRevenue?.toFixed(2) || '0.00'}
**Total Orders:** ${totalOrders || 0}
**Average Order Value:** $${avgOrderValue?.toFixed(2) || '0.00'}
**Last Order:** ${lastOrderDate || 'Unknown'}
**Account Age:** ${accountAge || 'Unknown'}
**Top Products Ordered:** ${topProducts || 'Various bakery items'}

Generate exactly 5 creative engagement ideas. Each should be specifically designed to get Taylor's Bakery in front of this customer more often. Think about:
- Free sample drop-offs (donuts, cookie trays, etc.) timed around their busy periods
- Seasonal/holiday promotions specific to their industry
- Loyalty milestones and appreciation gestures
- Cross-sell/upsell opportunities based on their order history
- Re-engagement if they've gone quiet
- Office/workplace specific promotions

For each idea, include:
1. A catchy title
2. The specific offer or action
3. Suggested email subject line
4. A brief email body draft (2-3 sentences, warm and professional)
5. Best timing to execute
6. Expected impact (high/medium/low)

Respond in JSON format with this structure:
{
  "ideas": [
    {
      "title": "string",
      "offer": "string",
      "emailSubject": "string",
      "emailBody": "string",
      "timing": "string",
      "impact": "high|medium|low",
      "category": "free_sample|seasonal|loyalty|cross_sell|reengagement|appreciation"
    }
  ],
  "accountInsight": "A 1-2 sentence summary of this account's health and opportunity"
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;

    const llmRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        stream: true,
      }),
    });

    if (!llmRes.ok) {
      const errText = await llmRes.text();
      console.error('LLM API error:', errText);
      return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
    }

    // Stream back with buffering
    const reader = llmRes.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'No stream' }, { status: 500 });

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let partialRead = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            partialRead += decoder.decode(value, { stream: true });
            const lines = partialRead.split('\n');
            partialRead = lines.pop() || '';
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  try {
                    const finalResult = JSON.parse(buffer);
                    const finalData = JSON.stringify({ status: 'completed', result: finalResult });
                    controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                  } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Failed to parse AI response' })}\n\n`));
                  }
                  return;
                }
                try {
                  const parsed = JSON.parse(data);
                  buffer += parsed.choices?.[0]?.delta?.content || '';
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'processing', message: 'Generating ideas...' })}\n\n`));
                } catch (e) { /* skip */ }
              }
            }
          }
          // If we got here without [DONE], try to parse what we have
          if (buffer) {
            try {
              const finalResult = JSON.parse(buffer);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'completed', result: finalResult })}\n\n`));
            } catch (e) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Incomplete AI response' })}\n\n`));
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'error', message: 'Stream error' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('POST /api/crm/generate-engagement error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
