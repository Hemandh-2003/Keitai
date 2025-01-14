const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);

    if (!product || product.isDeleted || product.isBlocked) {
      return res.status(404).json({ error: 'Product not found or unavailable' });
    }

    let cart = await Cart.findOne({ user: req.session.user._id });
    if (!cart) {
      cart = new Cart({ user: req.session.user._id, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);
    const requestedQuantity = parseInt(quantity, 10);
    const maxQuantity = 5;

    if (existingItem) {
      const newTotalQuantity = existingItem.quantity + requestedQuantity;
      if (newTotalQuantity > maxQuantity) {
        return res.status(400).json({
          error: `You can only have up to ${maxQuantity} units of this product in your cart.`,
          currentQuantity: existingItem.quantity,
        });
      }
      existingItem.quantity = newTotalQuantity;
    } else {
      if (requestedQuantity > maxQuantity) {
        return res.status(400).json({
          error: `You can only have up to ${maxQuantity} units of this product in your cart.`,
        });
      }
      cart.items.push({ product: productId, quantity: requestedQuantity });
    }

    await cart.calculateTotal();
    await cart.save();
    res.status(200).json({ message: 'Item added to cart', cart });
  } catch (error) {
    console.error(`Error adding item to cart: ${error.message}`);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.session.user._id }).populate('items.product');
    res.render("user/cart", { cart: cart || { items: [] } }); // Pass the cart data to the view
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

exports.updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const requestedQuantity = parseInt(quantity, 10);
    const maxQuantity = 5;

    if (requestedQuantity < 1 || requestedQuantity > maxQuantity) {
      return res.status(400).json({
        error: `Quantity must be between 1 and ${maxQuantity}.`,
      });
    }

    const cart = await Cart.findOne({ user: req.session.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) return res.status(404).json({ error: 'Product not in cart' });

    item.quantity = requestedQuantity;
    await cart.calculateTotal(); // Assuming this method updates cart.totalPrice
    await cart.save();

    res.json({ cart });
  } catch (error) {
    console.error(`Error updating cart: ${error.message}`);
    res.status(500).json({ error: 'Failed to update cart' });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const cart = await Cart.findOne({ user: req.session.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.calculateTotal();
    await cart.save();

    res.redirect('/cart');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
