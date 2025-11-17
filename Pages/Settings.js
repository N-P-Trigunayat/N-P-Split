import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "CLP", name: "Chilean Peso", symbol: "CLP$" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "COP", name: "Colombian Peso", symbol: "COL$" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
];

export default function Settings() {
  const [exporting, setExporting] = useState(false);
  const [user, setUser] = useState(null);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setDefaultCurrency(u.default_currency || "USD");
    }).catch(() => {});
  }, []);

  const { data: expenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
    initialData: [],
  });

  const { data: settlements } = useQuery({
    queryKey: ['settlements'],
    queryFn: () => base44.entities.Settlement.list('-date'),
    initialData: [],
  });

  const updateUserMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      toast.success("Settings updated! Refresh to see changes.");
    },
  });

  const handleCurrencyChange = (currency) => {
    setDefaultCurrency(currency);
    updateUserMutation.mutate({ default_currency: currency });
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      if (expenses.length === 0) {
        toast.error("No expenses to export");
        setExporting(false);
        return;
      }

      const csvData = expenses.map(exp => {
        const payer = exp.payers?.[0]?.email || exp.payers?.[0] || '';
        const splitWith = exp.splits?.map(s => s.email).join('; ') || '';
        
        return {
          'Date': exp.date,
          'Description': exp.description,
          'Amount': exp.amount,
          'Currency': exp.currency || 'USD',
          'Category': exp.category,
          'Paid By': payer,
          'Split With': splitWith,
          'Split Method': exp.split_method || 'equal',
          'Payment Method': exp.payment_method || '',
          'Group ID': exp.group_id || '',
          'Due Date': exp.due_date || '',
          'Created Date': exp.created_date ? format(new Date(exp.created_date), 'yyyy-MM-dd HH:mm:ss') : ''
        };
      });

      // Add settlements to the export
      const settlementData = settlements.map(settlement => ({
        'Date': settlement.date,
        'Description': 'Payment Settlement',
        'Amount': settlement.amount,
        'Currency': settlement.currency || 'USD',
        'Category': 'settlement',
        'Paid By': settlement.from_user,
        'Split With': settlement.to_user,
        'Split Method': 'settlement',
        'Payment Method': settlement.payment_method || '',
        'Group ID': settlement.group_id || '',
        'Due Date': '',
        'Created Date': settlement.created_date ? format(new Date(settlement.created_date), 'yyyy-MM-dd HH:mm:ss') : ''
      }));

      const allData = [...csvData, ...settlementData].sort((a, b) => 
        new Date(b.Date) - new Date(a.Date)
      );

      const headers = Object.keys(allData[0]);
      const csvRows = allData.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      );

      const csvContent = [headers.join(','), ...csvRows].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `splitease_complete_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${expenses.length} expenses and ${settlements.length} settlements!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
    }
    setExporting(false);
  };

  const exportToJSON = () => {
    setExporting(true);
    try {
      const jsonData = {
        version: "1.0.0",
        exported_at: new Date().toISOString(),
        user: {
          email: user?.email,
          name: user?.full_name,
          default_currency: defaultCurrency
        },
        expenses: expenses,
        settlements: settlements,
        total_expenses: expenses.length,
        total_settlements: settlements.length,
        total_amount: expenses.reduce((sum, e) => sum + e.amount, 0)
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `splitease_backup_${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Complete backup created!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to backup");
    }
    setExporting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Manage your preferences and data</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Currency</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select your preferred default currency</Label>
                <Select value={defaultCurrency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {CURRENCIES.map(currency => (
                      <SelectItem key={currency.code} value={currency.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{currency.symbol}</span>
                          <span>{currency.code}</span>
                          <span className="text-slate-500 text-sm">- {currency.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  This will be the default currency for new expenses. You can still change it per expense.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export & Backup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-semibold">Export All Data to CSV</p>
                  <p className="text-sm text-slate-500">Download expenses and settlements in spreadsheet format</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {expenses.length} expenses • {settlements.length} settlements
                  </p>
                </div>
                <Button 
                  onClick={exportToCSV} 
                  disabled={exporting || (expenses.length === 0 && settlements.length === 0)} 
                  variant="outline"
                  className="shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-semibold">Complete Backup (JSON)</p>
                  <p className="text-sm text-slate-500">Download complete data backup with all metadata</p>
                  <p className="text-xs text-slate-400 mt-1">Full backup with metadata</p>
                </div>
                <Button 
                  onClick={exportToJSON} 
                  disabled={exporting} 
                  variant="outline"
                  className="shrink-0"
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  Backup JSON
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">SplitEase</span> - A comprehensive expense splitting application
                </p>
                <p className="text-xs text-slate-400">Version 1.0.0</p>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Multi-currency support:</span> {CURRENCIES.length}+ currencies available
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-semibold">Export formats:</span> CSV (combined), JSON (full backup)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}