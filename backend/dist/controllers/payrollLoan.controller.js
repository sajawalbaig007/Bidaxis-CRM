"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayrollLoans = listPayrollLoans;
exports.lookupPayrollLoan = lookupPayrollLoan;
exports.upsertPayrollLoan = upsertPayrollLoan;
exports.deletePayrollLoan = deletePayrollLoan;
const db_1 = __importDefault(require("../config/db"));
function normName(n) {
    return n.trim().toLowerCase();
}
async function listPayrollLoans(req, res) {
    try {
        const name = String(req.query.name ?? "").trim();
        const department = String(req.query.department ?? "").trim();
        let loans = await db_1.default.payrollLoan.findMany({ orderBy: { updatedAt: "desc" } });
        if (name) {
            const q = normName(name);
            loans = loans.filter(l => normName(l.employeeName).includes(q));
        }
        if (department) {
            loans = loans.filter(l => l.department === department);
        }
        return res.json({ success: true, loans });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to list loans." });
    }
}
async function lookupPayrollLoan(req, res) {
    try {
        const name = String(req.query.name ?? "").trim();
        if (!name) {
            return res.status(400).json({ success: false, message: "Name required." });
        }
        const loans = await db_1.default.payrollLoan.findMany({ orderBy: { updatedAt: "desc" } });
        const match = loans.find(l => normName(l.employeeName) === normName(name))
            ?? loans.find(l => normName(l.employeeName).includes(normName(name)));
        return res.json({ success: true, loan: match ?? null });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Loan lookup failed." });
    }
}
async function upsertPayrollLoan(req, res) {
    try {
        const { id, employeeName, department, totalAmount, paidAmount } = req.body;
        if (!employeeName?.trim()) {
            return res.status(400).json({ success: false, message: "Employee name required." });
        }
        const payload = {
            employeeName: employeeName.trim(),
            department: (department ?? "sales_team").trim(),
            totalAmount: Number(totalAmount) || 0,
            paidAmount: Number(paidAmount) || 0,
            updatedBy: req.user?.id ?? null,
        };
        const loan = id
            ? await db_1.default.payrollLoan.update({ where: { id }, data: payload })
            : await db_1.default.payrollLoan.create({ data: payload });
        return res.json({ success: true, loan });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to save loan." });
    }
}
async function deletePayrollLoan(req, res) {
    try {
        const id = String(req.params.id ?? "");
        await db_1.default.payrollLoan.delete({ where: { id } });
        return res.json({ success: true });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ success: false, message: "Failed to delete loan." });
    }
}
