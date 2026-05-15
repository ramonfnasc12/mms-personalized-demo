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
    console.log('⚠ Falling back to simple product search...');

    // Fallback: find any product in stock at this store
    try {
      const fallbackResults = await db
        .collection('products')
        .find({
          inventory: {
            $elemMatch: {
              storeId: storeId,
              quantity: { $gt: 0 }
            }
          }
        })
        .limit(10)
        .toArray();

      if (fallbackResults.length === 0) {
        console.log(`⚠ No products in stock at store ${storeId}`);
        return null;
      }

      // Pick a random product from available ones
      const randomProduct = fallbackResults[Math.floor(Math.random() * fallbackResults.length)];
      const productWithScore = {
        ...randomProduct,
        searchableText: randomProduct.searchableText || `${randomProduct.name} - ${randomProduct.description}`,
        score: 0.5
      } as ProductWithScore;

      console.log(`✓ Fallback found product: ${productWithScore.name}`);
      return productWithScore;
    } catch (fallbackError) {
      console.error('Fallback search also failed:', fallbackError);
      return null;
    }
  }
}
