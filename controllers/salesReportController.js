const Order = require('../models/Order');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const {HTTP_STATUS}= require('../SM/status');

//Report
exports.renderSalesReportPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const allOrders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('user', 'name');

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const paginatedOrders = allOrders.slice(skip, skip + limit);

    const summary = calculateSummary(allOrders);

    res.render('admin/salesReport', {
      orders: paginatedOrders,
      summary,
      startDate: startOfDay.toISOString().split('T')[0],
      endDate: endOfDay.toISOString().split('T')[0],
      currentPage: page,
      totalPages,
      filterType: "daily"  
    });
  } catch (err) {
    console.error('Error loading sales report:', err.message);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Server error');
  }
};


exports.filterSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filterType = req.body.filterType || req.query.filterType || "custom"; 
    let { startDate, endDate } = req.body.startDate ? req.body : req.query;

    const today = new Date();

    if (filterType === "daily") {
      startDate = new Date(today.setHours(0, 0, 0, 0));
      endDate = new Date(today.setHours(23, 59, 59, 999));
    } 
    else if (filterType === "monthly") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = firstDay;
      endDate = new Date(lastDay.setHours(23, 59, 59, 999));
    } 
    else if (filterType === "yearly") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      startDate = firstDay;
      endDate = new Date(lastDay.setHours(23, 59, 59, 999));
    } 
    else {
      if (!startDate || !endDate) {
        return res.status(HTTP_STATUS.BAD_REQUEST).send("Start and End Date are required for custom filter");
      }
      startDate = new Date(startDate);
      endDate = new Date(endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const allOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate("user", "name");

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);
    const orders = allOrders.slice(skip, skip + limit);

    const summary = calculateSummary(allOrders);

    res.render("admin/salesReport", {
      orders,
      summary,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      currentPage: page,
      totalPages,
      filterType
    });
  } catch (err) {
    console.error("Filter Error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Filter error");
  }
};



function calculateSummary(orders) {
  let totalSales = orders.length || 0;
  let totalAmount = 0;
  let totalDiscount = 0;

  orders.forEach(order => {
    totalAmount += order.totalAmount || 0;
    totalDiscount += (order.discountAmount || 0) + (order.couponDiscount || 0);
  });

  return {
    totalSales,
    totalAmount,
    totalDiscount
  };
}

exports.downloadSalesReportExcel = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Start date and end date are required.');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); 

    const orders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    }).populate('user', 'name');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    sheet.mergeCells('A1', 'E1');
    sheet.getCell('A1').value = 'Sales Report';
    sheet.getCell('A1').alignment = { horizontal: 'center' };
    sheet.getCell('A1').font = { size: 16, bold: true };

    sheet.mergeCells('A2', 'E2');
    sheet.getCell('A2').value = `From: ${moment(start).format('YYYY-MM-DD')} To: ${moment(end).format('YYYY-MM-DD')}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.columns = [
      { header: 'User Name', key: 'userName', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Amount (₹)', key: 'amount', width: 18 },
      { header: 'Discount (₹)', key: 'discount', width: 18 },
      { header: 'Coupon (₹)', key: 'coupon', width: 18 }
    ];

    let totalAmount = 0;
    let totalDiscount = 0;
    let totalCoupon = 0;

    orders.forEach(order => {
      const discount = order.discountAmount || 0;
      const coupon = order.couponDiscount || 0;
      const amount = order.totalAmount || 0;

      totalAmount += amount;
      totalDiscount += discount;
      totalCoupon += coupon;

      sheet.addRow({
        userName: order.user?.name || 'N/A',
        date: moment(order.createdAt).format('YYYY-MM-DD'),
        amount: amount.toFixed(2),
        discount: discount.toFixed(2),
        coupon: coupon.toFixed(2),
      });
    });

    sheet.addRow({});

    sheet.addRow(['Summary']);
    sheet.addRow([`Total Orders:`, orders.length]);
    sheet.addRow([`Total Sales Amount:`, '', '', '', `₹${totalAmount.toFixed(2)}`]);
    sheet.addRow([`Total Discounts (incl. coupon):`, '', '', '', `₹${(totalDiscount + totalCoupon).toFixed(2)}`]);

    const summaryTitleRow = sheet.getRow(sheet.lastRow.number - 3);
    summaryTitleRow.font = { bold: true, underline: true };

    const finalRows = [sheet.lastRow.number - 2, sheet.lastRow.number - 1];
    finalRows.forEach(rowNum => {
      const row = sheet.getRow(rowNum);
      row.font = { bold: true };
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel Report Generation Error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Failed to generate sales report.');
  }
};

exports.downloadSalesReportPDF = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).send('Start and End Date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const orders = await Order.find({ createdAt: { $gte: start, $lte: end } }).populate('user', 'name');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=SalesReport.pdf');
    doc.pipe(res);

    const logoPath = path.join(__dirname, '../public/images/logo1.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 100 });
    }

    doc.moveDown(2);
    doc.fontSize(20).fillColor('#000000').text('Sales Report', { align: 'center' });
    doc.fontSize(12).fillColor('#555').text(`From: ${moment(start).format('YYYY-MM-DD')}   To: ${moment(end).format('YYYY-MM-DD')}`, { align: 'center' });
    doc.moveDown(1.5);

    let totalAmount = 0;
    let totalDiscount = 0;

    orders.forEach(order => {
      totalAmount += order.totalAmount;
      totalDiscount += (order.discountAmount || 0) + (order.couponDiscount || 0);
    });

    const generatedAt = moment().format('YYYY-MM-DD HH:mm:ss');

    doc
      .fontSize(12)
      .fillColor('#000')
      .font('Helvetica-Bold')
      .text('Summary', { underline: true });

    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(11)
      .text(`Generated At: ${generatedAt}`)
      .text(`Total Orders: ${orders.length}`)
      .text(`Total Sales Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`)
      .text(`Total Discounts (incl. coupon): ₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

    doc.moveDown(1.5);

    const tableTop = doc.y;
    const colSpacing = [90, 100, 90, 90, 90];

    const drawRow = (y, row, isHeader = false, alt = false) => {
      const fillColor = isHeader ? '#3f3f3f' : alt ? '#f8f8f8' : '#ffffff';

      doc
        .rect(40, y, 515, 20)
        .fill(fillColor)
        .fillColor(isHeader ? '#fff' : '#000')
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10);

      let x = 45;
      row.forEach((text, i) => {
        doc.text(text, x, y + 5, {
          width: colSpacing[i],
          align: 'left',
        });
        x += colSpacing[i];
      });
    };

    drawRow(tableTop, ['User Name', 'Date', 'Amount (₹)', 'Discount (₹)', 'Coupon (₹)'], true);

    let y = tableTop + 20;
    orders.forEach((order, i) => {
      const alt = i % 2 === 0;
      const orderRow = [
        order.user?.name || 'N/A',
        moment(order.createdAt).format('YYYY-MM-DD'),
        order.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (order.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        (order.couponDiscount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      ];
      drawRow(y, orderRow, false, alt);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Failed to generate PDF');
  }
};