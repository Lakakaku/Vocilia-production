/**
 * Invoice Generator - Fake Invoice System for Testing
 * 
 * Generates professional Swedish invoices for business billing cycles
 * with comprehensive VAT calculations and payment tracking.
 */

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;          // SEK
  totalPrice: number;         // SEK
  vatRate: number;            // 0.25 for 25% Swedish VAT
  vatAmount: number;          // SEK
}

interface Invoice {
  id: string;
  invoiceNumber: string;       // Human-readable invoice number (INV-2024-001)
  billingCycleId: string;
  businessId: string;
  
  // Invoice details
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  
  // Company information
  issuer: {
    name: string;
    address: string;
    orgNumber: string;
    vatNumber: string;
    bankAccount: string;
    email: string;
    phone: string;
  };
  
  // Client information
  client: {
    name: string;
    address: string;
    orgNumber: string;
    contactEmail: string;
    tier: number;
  };
  
  // Invoice content
  lineItems: InvoiceLineItem[];
  
  // Financial summary
  financials: {
    subtotal: number;          // Total before VAT (SEK)
    vatAmount: number;         // Total VAT (SEK)
    totalAmount: number;       // Total including VAT (SEK)
    processingFees: number;    // Deducted processing fees (SEK)
    netAmount: number;         // Amount due to platform (SEK)
  };
  
  // Status and payment info
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: 'bank_transfer' | 'card' | 'swish' | 'invoice';
  paymentReference?: string;
  
  // Swedish compliance
  currency: 'SEK';
  vatRegistration: string;    // Swedish VAT registration
  paymentTerms: string;       // Swedish payment terms
  
  // Additional data
  notes?: string;
  attachments?: string[];
  remindersSent: number;
  lastReminderDate?: Date;
}

interface InvoiceTemplate {
  name: string;
  description: string;
  logoUrl?: string;
  headerColor: string;
  footerText: string;
  paymentInstructions: string;
  termsAndConditions: string;
}

export class InvoiceGenerator {
  private invoices: Map<string, Invoice> = new Map();
  private invoiceCounter: number = 1;
  
  private readonly companyInfo = {
    name: 'AI Feedback Platform AB',
    address: 'Kungsgatan 45, 111 56 Stockholm, Sweden',
    orgNumber: '559123-4567',
    vatNumber: 'SE559123456701',
    bankAccount: 'SE85 8000 0000 0001 2345 6789',
    email: 'billing@aifeedback.se',
    phone: '+46 8 123 45 67'
  };

  private readonly defaultTemplate: InvoiceTemplate = {
    name: 'Swedish Standard',
    description: 'Standard Swedish business invoice template',
    headerColor: '#2563eb',
    footerText: 'Tack för ditt förtroende! / Thank you for your trust!',
    paymentInstructions: 'Betalning sker inom 30 dagar via bankgiro eller Swish.',
    termsAndConditions: 'Dröjsmålsränta 8% per år enligt räntelagen. Vid försenad betalning debiteras påminnelseavgift 60 SEK.'
  };

  /**
   * Generate invoice from billing cycle
   */
  async generateInvoice(
    billingCycleId: string,
    businessInfo: {
      name: string;
      address?: string;
      orgNumber: string;
      contactEmail: string;
      tier: number;
    },
    billingData: {
      totalTransactions: number;
      totalCommissions: number;
      processingFees: number;
      billingPeriod: { startDate: Date; endDate: Date };
    }
  ): Promise<Invoice> {
    const invoiceNumber = this.generateInvoiceNumber();
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    
    // Create line items
    const lineItems: InvoiceLineItem[] = [
      {
        description: `AI Feedback Platform Commission (${this.formatPeriod(billingData.billingPeriod)})`,
        quantity: billingData.totalTransactions,
        unitPrice: Math.round((billingData.totalCommissions / billingData.totalTransactions) * 100) / 100,
        totalPrice: billingData.totalCommissions,
        vatRate: 0.25, // 25% Swedish VAT
        vatAmount: Math.round(billingData.totalCommissions * 0.25 * 100) / 100
      }
    ];
    
    // Add processing fee deduction
    if (billingData.processingFees > 0) {
      lineItems.push({
        description: 'Processing Fees Deduction',
        quantity: 1,
        unitPrice: -billingData.processingFees,
        totalPrice: -billingData.processingFees,
        vatRate: 0.25,
        vatAmount: Math.round(-billingData.processingFees * 0.25 * 100) / 100
      });
    }
    
    // Calculate financials
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const vatAmount = lineItems.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = subtotal + vatAmount;
    const netAmount = totalAmount;
    
    const invoice: Invoice = {
      id: this.generateInvoiceId(),
      invoiceNumber,
      billingCycleId,
      businessId: businessInfo.orgNumber,
      
      issueDate,
      dueDate,
      
      issuer: this.companyInfo,
      client: {
        name: businessInfo.name,
        address: businessInfo.address || 'Address not provided',
        orgNumber: businessInfo.orgNumber,
        contactEmail: businessInfo.contactEmail,
        tier: businessInfo.tier
      },
      
      lineItems,
      
      financials: {
        subtotal: Math.round(subtotal * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        processingFees: billingData.processingFees,
        netAmount: Math.round(netAmount * 100) / 100
      },
      
      status: 'draft',
      currency: 'SEK',
      vatRegistration: 'SE559123456701',
      paymentTerms: '30 dagar netto / 30 days net',
      remindersSent: 0
    };
    
    this.invoices.set(invoice.id, invoice);
    
    console.log(`📄 Generated invoice ${invoiceNumber} for ${businessInfo.name}`);
    console.log(`💰 Amount: ${invoice.financials.totalAmount.toFixed(2)} SEK (incl. VAT)`);
    console.log(`📅 Due: ${dueDate.toISOString().split('T')[0]}`);
    
    return invoice;
  }

  /**
   * Generate invoice as text/HTML format
   */
  async generateInvoiceDocument(invoiceId: string, format: 'text' | 'html' = 'text'): Promise<string> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    
    if (format === 'html') {
      return this.generateHTMLInvoice(invoice);
    } else {
      return this.generateTextInvoice(invoice);
    }
  }

  /**
   * Generate text-based invoice
   */
  private generateTextInvoice(invoice: Invoice): string {
    const lines = [];
    
    // Header
    lines.push('='.repeat(80));
    lines.push(`                         FAKTURA / INVOICE`);
    lines.push('='.repeat(80));
    lines.push('');
    
    // Company info
    lines.push('FRÅN / FROM:');
    lines.push(invoice.issuer.name);
    lines.push(invoice.issuer.address);
    lines.push(`Org.nr: ${invoice.issuer.orgNumber}`);
    lines.push(`VAT: ${invoice.issuer.vatNumber}`);
    lines.push(`E-post: ${invoice.issuer.email}`);
    lines.push(`Telefon: ${invoice.issuer.phone}`);
    lines.push('');
    
    // Client info
    lines.push('TILL / TO:');
    lines.push(invoice.client.name);
    lines.push(invoice.client.address);
    lines.push(`Org.nr: ${invoice.client.orgNumber}`);
    lines.push(`E-post: ${invoice.client.contactEmail}`);
    lines.push(`Kundkategori: Tier ${invoice.client.tier}`);
    lines.push('');
    
    // Invoice details
    lines.push('-'.repeat(80));
    lines.push(`Fakturanummer: ${invoice.invoiceNumber}`);
    lines.push(`Faktureringsdatum: ${invoice.issueDate.toISOString().split('T')[0]}`);
    lines.push(`Förfallodatum: ${invoice.dueDate.toISOString().split('T')[0]}`);
    lines.push(`Betalningsvillkor: ${invoice.paymentTerms}`);
    lines.push(`Valuta: ${invoice.currency}`);
    lines.push('-'.repeat(80));
    lines.push('');
    
    // Line items
    lines.push('SPECIFIKATION / SPECIFICATION:');
    lines.push('-'.repeat(80));
    lines.push('Beskrivning'.padEnd(40) + 'Antal'.padStart(10) + 'Enhetspris'.padStart(15) + 'Belopp'.padStart(15));
    lines.push('-'.repeat(80));
    
    invoice.lineItems.forEach(item => {
      lines.push(
        item.description.substring(0, 40).padEnd(40) +
        item.quantity.toString().padStart(10) +
        `${item.unitPrice.toFixed(2)} SEK`.padStart(15) +
        `${item.totalPrice.toFixed(2)} SEK`.padStart(15)
      );
    });
    
    lines.push('-'.repeat(80));
    lines.push('');
    
    // Financial summary
    lines.push('SUMMA / SUMMARY:');
    lines.push('-'.repeat(80));
    lines.push('Delsumma (exkl. moms)'.padEnd(50) + `${invoice.financials.subtotal.toFixed(2)} SEK`.padStart(30));
    lines.push('Moms (25%)'.padEnd(50) + `${invoice.financials.vatAmount.toFixed(2)} SEK`.padStart(30));
    lines.push('='.repeat(80));
    lines.push('TOTALT ATT BETALA'.padEnd(50) + `${invoice.financials.totalAmount.toFixed(2)} SEK`.padStart(30));
    lines.push('='.repeat(80));
    lines.push('');
    
    // Payment info
    lines.push('BETALNINGSINFORMATION / PAYMENT INFORMATION:');
    lines.push('-'.repeat(80));
    lines.push(`Bankgiro: ${invoice.issuer.bankAccount}`);
    lines.push(`Referens: ${invoice.invoiceNumber}`);
    lines.push(`Swish: ${invoice.issuer.phone.replace(/\s/g, '')}`);
    lines.push('');
    lines.push(this.defaultTemplate.paymentInstructions);
    lines.push('');
    
    // Footer
    lines.push('-'.repeat(80));
    lines.push(this.defaultTemplate.termsAndConditions);
    lines.push('');
    lines.push(this.defaultTemplate.footerText);
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }

  /**
   * Generate HTML invoice
   */
  private generateHTMLInvoice(invoice: Invoice): string {
    return `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Faktura ${invoice.invoiceNumber}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { background: ${this.defaultTemplate.headerColor}; color: white; padding: 20px; text-align: center; }
        .invoice-details { display: flex; justify-content: space-between; margin: 20px 0; }
        .company-info, .client-info { width: 45%; }
        .line-items { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .total { font-weight: bold; background-color: #f9f9f9; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>FAKTURA / INVOICE</h1>
        <h2>${invoice.invoiceNumber}</h2>
    </div>
    
    <div class="invoice-details">
        <div class="company-info">
            <h3>Från / From:</h3>
            <p><strong>${invoice.issuer.name}</strong><br>
            ${invoice.issuer.address}<br>
            Org.nr: ${invoice.issuer.orgNumber}<br>
            VAT: ${invoice.issuer.vatNumber}<br>
            E-post: ${invoice.issuer.email}<br>
            Telefon: ${invoice.issuer.phone}</p>
        </div>
        
        <div class="client-info">
            <h3>Till / To:</h3>
            <p><strong>${invoice.client.name}</strong><br>
            ${invoice.client.address}<br>
            Org.nr: ${invoice.client.orgNumber}<br>
            E-post: ${invoice.client.contactEmail}<br>
            Kundkategori: Tier ${invoice.client.tier}</p>
        </div>
    </div>
    
    <div class="invoice-meta">
        <p><strong>Faktureringsdatum:</strong> ${invoice.issueDate.toISOString().split('T')[0]}</p>
        <p><strong>Förfallodatum:</strong> ${invoice.dueDate.toISOString().split('T')[0]}</p>
        <p><strong>Betalningsvillkor:</strong> ${invoice.paymentTerms}</p>
    </div>
    
    <div class="line-items">
        <table>
            <thead>
                <tr>
                    <th>Beskrivning</th>
                    <th>Antal</th>
                    <th>Enhetspris</th>
                    <th>Belopp</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.lineItems.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>${item.unitPrice.toFixed(2)} SEK</td>
                        <td>${item.totalPrice.toFixed(2)} SEK</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Delsumma (exkl. moms)</strong></td>
                    <td><strong>${invoice.financials.subtotal.toFixed(2)} SEK</strong></td>
                </tr>
                <tr>
                    <td colspan="3"><strong>Moms (25%)</strong></td>
                    <td><strong>${invoice.financials.vatAmount.toFixed(2)} SEK</strong></td>
                </tr>
                <tr class="total">
                    <td colspan="3"><strong>TOTALT ATT BETALA</strong></td>
                    <td><strong>${invoice.financials.totalAmount.toFixed(2)} SEK</strong></td>
                </tr>
            </tfoot>
        </table>
    </div>
    
    <div class="payment-info">
        <h3>Betalningsinformation / Payment Information:</h3>
        <p><strong>Bankgiro:</strong> ${invoice.issuer.bankAccount}<br>
        <strong>Referens:</strong> ${invoice.invoiceNumber}<br>
        <strong>Swish:</strong> ${invoice.issuer.phone.replace(/\s/g, '')}</p>
        <p>${this.defaultTemplate.paymentInstructions}</p>
    </div>
    
    <div class="footer">
        <p>${this.defaultTemplate.termsAndConditions}</p>
        <p><em>${this.defaultTemplate.footerText}</em></p>
    </div>
</body>
</html>`;
  }

  /**
   * Mark invoice as sent
   */
  async sendInvoice(invoiceId: string): Promise<void> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    
    invoice.status = 'sent';
    console.log(`📧 Invoice ${invoice.invoiceNumber} sent to ${invoice.client.contactEmail}`);
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(
    invoiceId: string,
    paidDate: Date,
    paymentMethod: 'bank_transfer' | 'card' | 'swish' | 'invoice',
    paymentReference: string
  ): Promise<void> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }
    
    invoice.status = 'paid';
    invoice.paidDate = paidDate;
    invoice.paymentMethod = paymentMethod;
    invoice.paymentReference = paymentReference;
    
    console.log(`✅ Invoice ${invoice.invoiceNumber} marked as paid via ${paymentMethod}`);
    console.log(`💰 Amount: ${invoice.financials.totalAmount.toFixed(2)} SEK`);
  }

  /**
   * Get all invoices for a business
   */
  async getBusinessInvoices(businessId: string): Promise<Invoice[]> {
    return Array.from(this.invoices.values()).filter(
      invoice => invoice.businessId === businessId
    );
  }

  /**
   * Generate mock invoice data for testing
   */
  async generateMockInvoices(): Promise<{
    invoices: Invoice[];
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  }> {
    const mockBillingCycles = [
      {
        id: 'bill-cafe-aurora-001-2024-08',
        businessInfo: {
          name: 'Aurora Café Stockholm',
          address: 'Östermalm Torg 12, 114 42 Stockholm',
          orgNumber: '556123-4567',
          contactEmail: 'billing@auroracafe.se',
          tier: 1
        },
        billingData: {
          totalTransactions: 45,
          totalCommissions: 1250.75,
          processingFees: 87.50,
          billingPeriod: {
            startDate: new Date('2024-08-01'),
            endDate: new Date('2024-08-31')
          }
        }
      },
      {
        id: 'bill-malmo-huset-002-2024-08',
        businessInfo: {
          name: 'Malmö Huset Restaurant',
          address: 'Stortorget 8, 211 34 Malmö',
          orgNumber: '556234-5678',
          contactEmail: 'accounts@malmohuset.se',
          tier: 2
        },
        billingData: {
          totalTransactions: 78,
          totalCommissions: 2450.25,
          processingFees: 156.75,
          billingPeriod: {
            startDate: new Date('2024-08-01'),
            endDate: new Date('2024-08-31')
          }
        }
      },
      {
        id: 'bill-goteborg-store-003-2024-08',
        businessInfo: {
          name: 'Göteborg Department Store',
          address: 'Avenyn 15, 411 36 Göteborg',
          orgNumber: '556345-6789',
          contactEmail: 'finance@goteborgsstore.se',
          tier: 3
        },
        billingData: {
          totalTransactions: 156,
          totalCommissions: 4875.90,
          processingFees: 234.20,
          billingPeriod: {
            startDate: new Date('2024-08-01'),
            endDate: new Date('2024-08-31')
          }
        }
      }
    ];

    console.log('📄 Generating mock invoice data...');
    
    const generatedInvoices: Invoice[] = [];
    let totalAmount = 0;
    let paidAmount = 0;
    
    for (const cycle of mockBillingCycles) {
      const invoice = await this.generateInvoice(
        cycle.id,
        cycle.businessInfo,
        cycle.billingData
      );
      
      // Send the invoice
      await this.sendInvoice(invoice.id);
      
      // Randomly mark some as paid
      if (Math.random() > 0.3) { // 70% chance of being paid
        const paidDate = new Date();
        paidDate.setDate(paidDate.getDate() - Math.floor(Math.random() * 15)); // Paid 0-15 days ago
        
        const paymentMethods: ('bank_transfer' | 'swish')[] = ['bank_transfer', 'swish'];
        const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        
        await this.markInvoicePaid(
          invoice.id,
          paidDate,
          paymentMethod,
          `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        );
        
        paidAmount += invoice.financials.totalAmount;
      } else {
        // Check if overdue
        if (new Date() > invoice.dueDate) {
          invoice.status = 'overdue';
        }
      }
      
      generatedInvoices.push(invoice);
      totalAmount += invoice.financials.totalAmount;
    }
    
    const outstandingAmount = totalAmount - paidAmount;
    
    console.log(`✅ Generated ${generatedInvoices.length} mock invoices`);
    console.log(`💰 Total Amount: ${totalAmount.toFixed(2)} SEK`);
    console.log(`✅ Paid Amount: ${paidAmount.toFixed(2)} SEK`);
    console.log(`⏰ Outstanding: ${outstandingAmount.toFixed(2)} SEK`);
    
    return {
      invoices: generatedInvoices,
      totalAmount,
      paidAmount,
      outstandingAmount
    };
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(): Promise<{
    totalInvoices: number;
    totalAmount: number;
    paidInvoices: number;
    paidAmount: number;
    overdueInvoices: number;
    overdueAmount: number;
    averagePaymentDays: number;
  }> {
    const allInvoices = Array.from(this.invoices.values());
    
    const totalAmount = allInvoices.reduce((sum, inv) => sum + inv.financials.totalAmount, 0);
    const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
    const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.financials.totalAmount, 0);
    
    const overdueInvoices = allInvoices.filter(inv => inv.status === 'overdue');
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.financials.totalAmount, 0);
    
    // Calculate average payment days
    const paymentDays = paidInvoices
      .filter(inv => inv.paidDate)
      .map(inv => {
        const daysDiff = (inv.paidDate!.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff;
      });
    
    const averagePaymentDays = paymentDays.length > 0 
      ? paymentDays.reduce((sum, days) => sum + days, 0) / paymentDays.length 
      : 0;

    return {
      totalInvoices: allInvoices.length,
      totalAmount,
      paidInvoices: paidInvoices.length,
      paidAmount,
      overdueInvoices: overdueInvoices.length,
      overdueAmount,
      averagePaymentDays: Math.round(averagePaymentDays * 10) / 10
    };
  }

  /**
   * Helper methods
   */
  private generateInvoiceId(): string {
    return `inv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear();
    const number = this.invoiceCounter.toString().padStart(3, '0');
    this.invoiceCounter++;
    return `INV-${year}-${number}`;
  }

  private formatPeriod(period: { startDate: Date; endDate: Date }): string {
    const start = period.startDate.toISOString().split('T')[0];
    const end = period.endDate.toISOString().split('T')[0];
    return `${start} - ${end}`;
  }
}