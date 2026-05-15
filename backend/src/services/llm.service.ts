import { ChatBedrockConverse } from '@langchain/aws';
import { CustomerContext, Store } from '../models/types';

const llm = new ChatBedrockConverse({
  region: process.env.AWS_REGION || 'us-east-1',
  model: process.env.BEDROCK_TEXT_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export async function generateSearchContext(context: CustomerContext): Promise<string> {
  const { weather, event, customerActivity } = context;

  const prompt = `Generate a concise product search query (2-3 sentences) based on:
- Weather: ${weather.condition}, ${weather.temperature}°C
- Event: ${event.description}
- Customer recently viewed: ${customerActivity.recentViews.join(', ') || 'nothing'}
- Customer purchased: ${customerActivity.recentPurchases.join(', ') || 'nothing'}
- Items in cart: ${customerActivity.cartItems.join(', ') || 'nothing'}

Focus on what product category would be most relevant right now. Be specific about features that matter for this context.

Example output: "Portable cooling device suitable for extreme heat. Should be energy-efficient and easy to transport. Customer interested in electronics."`;

  try {
    const response = await llm.invoke(prompt);
    const searchQuery = typeof response.content === 'string'
      ? response.content
      : response.content.toString();

    console.log(`✓ Generated search context: "${searchQuery.substring(0, 100)}..."`);
    return searchQuery;
  } catch (error) {
    console.error('LLM error generating search context:', error);
    // Fallback to simple context
    return `Product for ${weather.condition} weather (${weather.temperature}°C) and ${event.type} event`;
  }
}

export async function generatePersonalizedMessage(
  product: any,
  context: CustomerContext,
  store: Store
): Promise<string> {
  const { weather, event, customerActivity } = context;

  const prompt = `You are a friendly MediaMarktSaturn sales assistant. Create a personalized notification (2-3 sentences) recommending this product:

Product: ${product.name}
Description: ${product.description}
Price: €${product.price}
Store: ${store.name}

Context:
- Weather: ${weather.label}
- Event: ${event.label}
- Customer profile: ${customerActivity.profile}

Make it conversational, mention why this product is perfect right now, and that it's in stock nearby. Don't be pushy.

Example: "Hey! With this heatwave hitting 40°C, you might love our Dyson Cool Tower Fan. It's in stock at MediaMarkt Munich Center, just 500m away. Stay cool! 🌬️"`;

  try {
    const response = await llm.invoke(prompt);
    const message = typeof response.content === 'string'
      ? response.content
      : response.content.toString();

    console.log(`✓ Generated personalized message for ${product.name}`);
    return message;
  } catch (error) {
    console.error('LLM error generating message:', error);
    // Fallback to generic message
    return `Check out ${product.name} at ${store.name}! Perfect for the current weather. Only €${product.price}.`;
  }
}
