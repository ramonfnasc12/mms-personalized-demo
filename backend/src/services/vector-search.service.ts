import { getDatabase } from '../config/database';
import { ProductWithScore } from '../models/types';

export async function findBestProduct(
  searchQuery: string,
  storeId: string
): Promise<ProductWithScore | null> {
  const db = getDatabase();

  const pipeline = [
    {
      $vectorSearch: {
        index: 'products_vector_index',
        path: 'searchableText',
        query: searchQuery,
        model: 'voyage-4',
        numCandidates: 100,
        limit: 10
      }
    },
    {
      $project: {
        _id: 0,
        productId: 1,
        name: 1,
        description: 1,
        price: 1,
        category: 1,
        inventory: 1,
        searchableText: 1,
        score: { $meta: 'vectorSearchScore' }
      }
    },
    {
      $match: {
        inventory: {
          $elemMatch: {
            storeId: storeId,
            quantity: { $gt: 0 }
          }
        }
      }
    },
    { $limit: 1 }
  ];

  try {
    const results = await db
      .collection('products')
      .aggregate(pipeline)
      .toArray();

    if (results.length === 0) {
      console.log(`⚠ No products found in stock at store ${storeId} for query: "${searchQuery.substring(0, 50)}..."`);
      return null;
    }

    const product = results[0] as ProductWithScore;
    console.log(`✓ Found product: ${product.name} (score: ${product.score.toFixed(4)})`);
    return product;
  } catch (error) {
    console.error('Vector search error:', error);
    throw error;
  }
}
