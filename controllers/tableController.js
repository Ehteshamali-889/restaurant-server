const tableService = require('../services/tableService');

const getTables = async (req, res) => {
  try {
    const filters = {
      branch: req.query.branch || req.user.branch,
      section: req.query.section,
      status: req.query.status,
    };
    const tables = await tableService.getTables(filters);
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTableStats = async (req, res) => {
  try {
    const branchId = req.query.branch || req.user.branch;
    const stats = await tableService.getTableStats(branchId);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getTableById = async (req, res) => {
  try {
    const table = await tableService.getTableById(req.params.id);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    res.status(200).json({ success: true, data: table });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTable = async (req, res) => {
  try {
    const table = await tableService.createTable(req.body);
    res.status(201).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateTable = async (req, res) => {
  try {
    const table = await tableService.updateTable(req.params.id, req.body);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    res.status(200).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const assignWaiter = async (req, res) => {
  try {
    const table = await tableService.assignWaiter(req.params.id, req.body.waiterId);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    res.status(200).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const table = await tableService.updateStatus(req.params.id, req.body.status);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }
    res.status(200).json({ success: true, data: table });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const deleteTable = async (req, res) => {
  try {
    await tableService.deleteTable(req.params.id);
    res.status(200).json({ success: true, message: 'Table deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTables,
  getTableStats,
  getTableById,
  createTable,
  updateTable,
  assignWaiter,
  updateStatus,
  deleteTable,
};
