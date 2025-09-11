function checkoutStepGuard(requiredStep) {
  return (req, res, next) => {
    const userStep = req.session.checkoutStep;

    const stepOrder = ['checkout', 'order-confirmation', 'confirm-payment', 'done'];

    if (stepOrder.indexOf(userStep) < stepOrder.indexOf(requiredStep)) {
      return res.redirect('/checkout'); 
    }


    if (stepOrder.indexOf(userStep) > stepOrder.indexOf(requiredStep)) {
      return res.redirect('/'); 
    }

    next();
  };
}

module.exports = checkoutStepGuard;
