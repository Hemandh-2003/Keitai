const Category = require('../models/Category');
const { HTTP_STATUS } = require('../SM/status');
// Category management
exports.loadCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.render('admin/categories', { categories, error: null }); 
  } catch (error) {
    console.error('Error loading categories:', error);
    res.status(500).send('Server Error');
  }
};

// Add a new category
exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const trimmedName = name.trim();

    if (!trimmedName) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'Category name cannot be empty.',
      });
    }

    if (!/^[A-Za-z\s]{1,11}$/.test(trimmedName)) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'Category name must contain only letters and up to 11 characters.',
      });
    }

    const slug = trimmedName.toLowerCase().replace(/\s+/g, '-');

    const existingCategory = await Category.findOne({ name: new RegExp(`^${trimmedName}$`, 'i') });
    if (existingCategory) {
      const categories = await Category.find();
      return res.render('admin/categories', {
        categories,
        error: 'This category already exists in the list.',
      });
    }

    const newCategory = new Category({ name: trimmedName, slug });
    await newCategory.save();

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error adding category:', error);
    const categories = await Category.find();
    return res.render('admin/categories', {
      categories,
      error: 'Something went wrong. Please try again.',
    });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await Category.findByIdAndDelete(id);
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).send('Server Error');
  }
};

// Edit a category
exports.loadEditCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    res.status(200).render('admin/edit-category', { category });
  } catch (error) {
    console.error('Error loading edit page:', error);
    res.status(500).send('Server Error');
  }
};

exports.editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const slug = name.toLowerCase().replace(/\s+/g, '-');

    
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.status(400).render('admin/edit-category', {
        errorMessage: 'Category name already exists.',
        category: { name }  
      });
    }

    
    await Category.findByIdAndUpdate(id, { name, slug });

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error editing category:', error);
    res.status(500).send('Server Error');
  }
};
