import stripe from "../utils/stripe.js";
import { promises as fs } from "fs";
import { checkProductExists, updateProduct } from "../utils/helpers.js";

/**
 * Retrieves product information based on the product ID provided in the request parameters.
 * @async
 * @function getProductInfo
 * @param {import('express').Request} req - Express request object containing the product ID in params.
 * @param {import('express').Response} res - Express response object used to send the result.
 * @returns {Promise<void>} Sends a JSON response with product data or error information.
 */
export const getProductInfo = async (req, res) => {
  try {
    const productId = req.params.id;

    const productCheck = await checkProductExists(productId);

    if (!productCheck.exists) {
      return res.status(404).json({
        error: "Product not found",
        details: `Product file ${productId}.json does not exist`,
        debugInfo: productCheck.error,
      });
    }

    const productData = await fs.readFile(productCheck.path, "utf-8");
    const product = JSON.parse(productData);

    const productWithAvailability = {
      ...product,
      available: product.stock > 0,
      outOfStock: product.stock <= 0,
      inStock: product.stock > 0,
    };

    res.json({
      success: true,
      data: productWithAvailability,
    });
  } catch (error) {
    console.error("Error loading product info:", error);
    return res.status(500).json({
      error: "Error loading product info",
    });
  }
};

/**
 * Creates a Stripe Checkout Session for a product purchase.
 * @async
 * @function createCheckoutSession
 * @param {import('express').Request} req - Express request object. Expects `quantity` in body and `product` in request (set by middleware).
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Responds with JSON containing checkout session URL on success; error message on failure.
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = req.product; // Información del producto cargada por el middleware

    // Crear la sesión de Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "paypal"], // Soporte para tarjetas y PayPal
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: {
              name: product.name,
            },
            unit_amount: product.amount,
          },
          quantity: quantity,
        },
      ],
      // URLs de redirección
      success_url: `${process.env.SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.CANCEL_URL,

      // Metadata para tracking
      metadata: {
        product_id: product.id,
        product_name: product.name,
        quantity: quantity.toString(),
        order_type: "single_purchase",
      },

      // Configuraciones adicionales
      customer_creation: "always", // Crear cliente en Stripe
      invoice_creation: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      product: {
        product_id: product.id,
        quantity,
        total_amount: product.amount * quantity,
        unit_price: product.amount,
        currency: product.currency,
      },
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return res.status(500).json({
      error: "Error creating checkout session",
    });
  }
};

/**
 * Retrieves the status of a Stripe Checkout Session.
 * @async
 * @function getCheckoutStatus
 * @param {import('express').Request} req - Express request object, expects `session_id` in params.
 * @param {import('express').Response} res - Express response object.
 * @returns {Promise<void>} Returns a JSON response with checkout session details or an error message.
 */
export const getCheckoutStatus = async (req, res) => {
  try {
    const { session_id } = req.params;

    if (!session_id) {
      return res.status(400).json({
        error: "session_id parameter is required",
      });
    }

    // Recuperar la sesión desde Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email,
        customer_name: session.customer_details?.name,
        payment_intent: session.payment_intent,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    console.error("Error retrieving checkout status:", error);
    return res.status(500).json({
      error: "Error retrieving checkout status",
    });
  }
};

/**
 * Webhook handler for Stripe events
 * @async
 * @function handleWebhook
 * @param {import('express').Request} req - Express request object with raw body
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<void>} Responds with acknowledgment or error
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      console.log("✅ Checkout completed:", session.id);

      //TODO: Hay una funcion llamada updateProduct que no se esta usando, deberia usarse aqui para actualizar el stock del producto
      const productId = session.metadata.product_id;
      const quantityPurchased = parseInt(session.metadata.quantity, 10);
      const productUpdateResult = await updateProduct(
        productId,
        async (currentProduct) => {
          currentProduct.stock -= quantityPurchased;
          return currentProduct;
        }
      );
      if (!productUpdateResult.success) {
        console.error(
          "Error updating product stock:",
          productUpdateResult.error
        );
      } else {
        console.log(`Product ${productId} stock updated successfully.`);
      }

      // Aquí puedes agregar lógica para:
      // - Generar factura
      // - Actualizar inventario
      // - Crear cuenta de usuario
      // - Etc.

      break;
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log(" Payment successful:", paymentIntent.id);
      break;
    case "payment_intent.payment_failed":
      const failedPayment = event.data.object;
      console.log(" Payment failed:", failedPayment.id);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};

export default {
  getProductInfo,
  createCheckoutSession,
  getCheckoutStatus,
  handleWebhook,
};
