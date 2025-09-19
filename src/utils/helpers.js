import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

//Para obtener __dirname en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Checks if a product file exists in the products directory
 * @async
 * @function checkProductExists
 * @param {string} productId - The product ID to check
 * @returns {Promise<{exists: boolean, path?: string, error?: string}>} Object containing existence status and path or error
 */
export const checkProductExists = async (productId) => {
  try {
    const productPath = path.join(
      __dirname,
      "..",
      "products",
      `${productId}.json`
    );

    // Check if file exists
    await fs.access(productPath);

    return {
      exists: true,
      path: productPath,
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message,
    };
  }
};

/**
 * Reads and parses a product JSON file
 * @async
 * @function getProduct
 * @param {string} productId - The product ID to load
 * @returns {Promise<{success: boolean, product?: Object, error?: string}>} Product data or error
 */
export const getProduct = async (productId) => {
  try {
    const productCheck = await checkProductExists(productId);

    if (!productCheck.exists) {
      return {
        success: false,
        error: `Product ${productId} not found`,
      };
    }

    const productData = await fs.readFile(productCheck.path, "utf-8");
    const product = JSON.parse(productData);

    return {
      success: true,
      product,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};


/**
 * Updates a product JSON file
 * @async
 * @function updateProduct
 * @param {string} productId - The product ID to update
 * @param {Object} updatedProduct - The updated product data
 * @returns {Promise<{success: boolean, error?: string}>} Success status or error
 */
export const updateProduct = async (productId, updatedProduct) => {
  try {
    const productCheck = await checkProductExists(productId);

    if (!productCheck.exists) {
      return {
        success: false,
        error: `Product ${productId} not found`,
      };
    }

    await fs.writeFile(
      productCheck.path,
      JSON.stringify(updatedProduct, null, 2),
      "utf-8"
    );

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};



