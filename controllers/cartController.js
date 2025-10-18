const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { MESSAGE } = require('../SM/messages');
const { HTTP_STATUS } = require('../SM/status');
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId);

    if (!product || product.isDeleted || product.isBlocked) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not found or unavailable' });
    }

    if (product.stock <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Product is out of stock' });
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
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `You can only have up to ${maxQuantity} units of this product in your cart.`,
          currentQuantity: existingItem.quantity,
        });
      }

      if (newTotalQuantity > product.stock) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `Only ${product.stock - existingItem.quantity} more unit(s) available in stock.`,
          currentQuantity: existingItem.quantity,
          stock: product.stock
        });
      }

      existingItem.quantity = newTotalQuantity;
    } else {
      if (requestedQuantity > maxQuantity) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `You can only have up to ${maxQuantity} units of this product in your cart.`,
        });
      }

      if (requestedQuantity > product.stock) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `Only ${product.stock} unit(s) available in stock.`,
          stock: product.stock
        });
      }

      cart.items.push({ product: productId, quantity: requestedQuantity });
    }

    await cart.calculateTotal();
    await cart.save();

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Item added to cart', cart });
  } catch (error) {
    console.error(`Error adding item to cart: ${error.message}`);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to add item to cart' });
  }
};

exports.getCart = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 4;

    const cart = await Cart.findOne({ user: req.session.user._id });

    if (!cart || cart.items.length === 0) {
      return res.render("user/cart", {
        cart: { items: [], totalPrice: 0 },
        currentPage: 1,
        totalPages: 0,
        hasBlockedProduct: false,
        blockedProductNames: []
      });
    }

    const totalItems = cart.items.length;
    const totalPages = Math.ceil(totalItems / perPage);

    if (page > totalPages) {
      return res.redirect(`/cart?page=${totalPages}`);
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const paginatedItems = cart.items.slice(start, end);

    const enhancedItems = [];
    let hasBlockedProduct = false;
    let blockedProductNames = [];

    for (const item of paginatedItems) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      const offer = await product.getBestOfferPrice?.();
      const offerPrice = offer?.price || product.salesPrice || product.regularPrice;

      if (product.isBlocked) {
        hasBlockedProduct = true;
        blockedProductNames.push(product.name);
      }

      enhancedItems.push({
        product: {
          _id: product._id,
          name: product.name,
          quantity: product.quantity,
          regularPrice: product.regularPrice,
          salesPrice: product.salesPrice,
          images: product.images,
          isBlocked: product.isBlocked,
          offerPrice
        },
        quantity: item.quantity
      });
    }

    const totalPrice = enhancedItems.reduce((sum, item) => {
      if (!item.product.isBlocked) {
        return sum + item.quantity * item.product.offerPrice;
      }
      return sum;
    }, 0);

    res.render("user/cart", {
      cart: {
        items: enhancedItems,
        totalPrice
      },
      currentPage: page,
      totalPages,
      hasBlockedProduct,
      blockedProductNames
    });

  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.SERVER_ERROR);
  }
};


exports.getCartCount = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ count: 0 });
    }

    const cart = await Cart.findOne({ user: req.session.user._id });

    const count = cart ? cart.items.reduce((acc, item) => acc + item.quantity, 0) : 0;
    return res.json({ count });
  } catch (error) {
    console.error("Error fetching cart count:", error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ count: 0 });
  }
};

exports.updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const requestedQuantity = parseInt(quantity, 10);
    const maxQuantity = 5;

    if (requestedQuantity < 1 || requestedQuantity > maxQuantity) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `Quantity must be between 1 and ${maxQuantity}.`,
        currentQuantity: requestedQuantity,
        errorType: 'MAX_LIMIT'
      });
    }

    const cart = await Cart.findOne({ user: req.session.user._id }).populate('items.product');
    if (!cart) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Cart not found' });

    const item = cart.items.find(item => item.product._id.toString() === productId);
    if (!item) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Product not in cart' });

    if (requestedQuantity > item.product.quantity) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
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
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to update cart' });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const cart = await Cart.findOne({ user: req.session.user._id });
    if (!cart) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.calculateTotal();
    await cart.save();

    res.redirect('/cart');
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: MESSAGE.SERVER_ERROR});
  }
};

exports.getProductDetails = async (req, res) => {
  try {
    const productId = req.params.productId;

    const product = await Product.findOne({ _id: productId, isBlocked: false }).populate('category');

    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).send('Product not found or is unavailable');
    }

    res.render('user/Product-details', {
      user: req.session.user,
      product,
    });
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(MESSAGE.INTERNAL_SERVER_ERROR);
  }
};
exports.clearCart = async (req, res) => {
  //console.log('Clear cart initiated - Session:', req.session);
  
  try {
    // Verify session exists
    if (!req.session.user?._id) {
      console.error('No user in session');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ 
        success: false,
        message: 'Not authenticated - Please login again' 
      });
    }

    const result = await Cart.updateOne(
      { user: req.session.user._id },
      { $set: { items: [], totalPrice: 0 } }
    );

    //console.log('Database result:', result);

    if (result.matchedCount === 0) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
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
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Server error during cart clearance',
      error: error.message
    });
  }
};