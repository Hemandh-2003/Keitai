const Cart = require('../models/Cart');
const Product = require('../models/Product');

//add to cart module
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

if (newTotalQuantity > product.quantity) {
  return res.status(400).json({
    error: `Only ${product.quantity - existingItem.quantity} more unit(s) available in stock.`,
    currentQuantity: existingItem.quantity,
    stock: product.quantity
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
//display the items in cart
exports.getCart = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 4;

    const cart = await Cart.findOne({ user: req.session.user._id });

    if (!cart || cart.items.length === 0) {
      return res.render("user/cart", { 
        cart: { items: [], totalPrice: 0 },
        currentPage: page,
        totalPages: 0
      });
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedItems = cart.items.slice(start, end);

    // Manually populate and attach offerPrice
    const enhancedItems = [];
    for (const item of paginatedItems) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      const offer = await product.getBestOfferPrice?.();  // ✅ Ensure getBestOfferPrice exists
      const offerPrice = offer?.price || product.salesPrice || product.regularPrice;

      enhancedItems.push({
        product: {
          _id: product._id,
          name: product.name,
          quantity: product.quantity,
          regularPrice: product.regularPrice,
          salesPrice: product.salesPrice,
          images: product.images,
          offerPrice
        },
        quantity: item.quantity
      });
    }

    // Calculate total pages
    const totalPages = Math.ceil(cart.items.length / perPage);

    // Compute new subtotal (optional, safer than trusting stale data)
    const totalPrice = enhancedItems.reduce((sum, item) => {
      return sum + item.quantity * item.product.offerPrice;
    }, 0);

    res.render("user/cart", {
      cart: {
        items: enhancedItems,
        totalPrice
      },
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).send("Server error");
  }
};


//updating the cart
exports.updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const requestedQuantity = parseInt(quantity, 10);
    const maxQuantity = 5;

    if (requestedQuantity < 1 || requestedQuantity > maxQuantity) {
      return res.status(400).json({
        error: `Quantity must be between 1 and ${maxQuantity}.`,
        currentQuantity: existingItem?.quantity || 1,
        errorType: 'MAX_LIMIT'
      });
    }

    const cart = await Cart.findOne({ user: req.session.user._id }).populate('items.product');
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(item => item.product._id.toString() === productId);
    if (!item) return res.status(404).json({ error: 'Product not in cart' });

    // Check stock availability
    if (requestedQuantity > item.product.quantity) {
      return res.status(400).json({
        error: `Only ${item.product.quantity} units available in stock.`,
        currentQuantity: item.quantity,
        errorType: 'STOCK_LIMIT'
      });
    }

    item.quantity = requestedQuantity;
    await cart.calculateTotal();
    await cart.save();

    res.json({ 
      success: true,
      cart: {
        totalPrice: cart.totalPrice
      }
    });
  } catch (error) {
    console.error(`Error updating cart: ${error.message}`);
    res.status(500).json({ error: 'Failed to update cart' });
  }
};

//remove items from cart
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

//view product page
exports.getProductDetails = async (req, res) => {
  try {
    const productId = req.params.productId;

    // Fetch the product, ensuring it's not blocked
    const product = await Product.findOne({ _id: productId, isBlocked: false }).populate('category');

    if (!product) {
      return res.status(404).send('Product not found or is unavailable');
    }

    res.render('user/Product-details', {
      user: req.session.user,
      product,
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).send('Internal Server Error');
  }
};
exports.clearCart = async (req, res) => {
  console.log('Clear cart initiated - Session:', req.session);
  
  try {
    // Verify session exists
    if (!req.session.user?._id) {
      console.error('No user in session');
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated - Please login again' 
      });
    }

    const result = await Cart.updateOne(
      { user: req.session.user._id },
      { $set: { items: [], totalPrice: 0 } }
    );

    console.log('Database result:', result);

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active cart found'
      });
    }

    return res.json({
      success: true,
      message: `Cart cleared successfully (${result.modifiedCount} items)`
    });

  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during cart clearance',
      error: error.message
    });
  }
};