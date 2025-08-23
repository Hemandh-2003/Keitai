// middlewares/checkoutFlow.js
function checkoutStepGuard(requiredStep) {
  return (req, res, next) => {
    const userStep = req.session.checkoutStep;

    const stepOrder = ['checkout', 'order-confirmation', 'confirm-payment', 'done'];

    // If user hasn’t reached this step yet → block
    if (stepOrder.indexOf(userStep) < stepOrder.indexOf(requiredStep)) {
      return res.redirect('/checkout'); // send back to start
    }

    // If user already passed this step → block back navigation
    if (stepOrder.indexOf(userStep) > stepOrder.indexOf(requiredStep)) {
      return res.redirect('/'); // or redirect to orders page
    }

    next();
  };
}

module.exports = checkoutStepGuard;
