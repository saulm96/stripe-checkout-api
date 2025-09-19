import { promises as fs } from "fs";
import { checkProductExists } from "../utils/helpers.js";

/**
 * Middleware to validate checkout data in the request body.
 * Ensures that `product_id` and `quantity` are present.
 * - `product_id` must be provided.
 * - `quantity` defaults to 1 if not provided and must be a positive integer.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const validateCheckoutData = (req, res, next) => {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({
      error: "Product ID is required",
    });
  }

  if (!quantity) {
    return res.status(400).json({
      error: "Quantity is required",
    });
  }

  if (quantity && (!Number.isInteger(quantity) || quantity < 1)) {
    return res.status(400).json({
      error: "Quantity must be a positive integer",
    });
  }

  next();
};

/**
 * Middleware to load product information based on `product_id` in the request body.
 * Checks if the product file exists in the 'products' directory, reads its contents,
 * and attaches the product data to `req.product`.
 * @async
 * @param {import('express').Request} req - Express request object containing `product_id` in body.
 * @param {import('express').Response} res - Express response object used to send the result.
 * @param {import('express').NextFunction} next - Express next middleware function.
 * @returns {Promise<void>} Calls `next()` if successful, otherwise sends an error response.
 */
export const loadProductInfo = async (req, res, next) => {
  try {
    const { product_id } = req.body;

    // Función para chequear que dentro de la carpeta products exista el archivo con el id del producto
    const productCheck = await checkProductExists(product_id);

    if (!productCheck.exists) {
      return res.status(404).json({
        error: "Product not found",
        details: `Product file ${product_id}.json does not exist`,
        debugInfo: productCheck.error,
      });
    }

    const productData = await fs.readFile(productCheck.path, "utf-8");
    const product = JSON.parse(productData);

    if (!product.stock || product.stock < 1) {
      return res.status(400).json({
        error: "Product out of stock",
        details: `The product with ID ${product_id} is out of stock`,
        available: false,
      });
    }
    if (req.body.quantity > product.stock) {
      return res.status(400).json({
        error: "Insufficient stock",
        details: `Requested quantity (${req.body.quantity}) exceeds available stock (${product.stock})`,
        available: true,
        stock: product.stock,
        requested: req.body.quantity,
      });
    }

    req.product = product;

    next();
  } catch (error) {
    console.error("Error loading product info:", error);
    return res.status(500).json({
      error: "Error loading product info",
    });
  }
};
