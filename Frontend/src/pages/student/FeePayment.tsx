
import { DashboardLayout } from "@/components/DashboardLayout";
import { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertCircle,
  CreditCard,
  Check,
  Clock,
  Download,
  Calendar
} from "lucide-react";
import { studentApi } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FeeItem {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  paidDate?: string;
  paymentMethod?: string;
  receiptNumber?: string;
}

interface FeeSummary {
  totalFees: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
}

const FeePayment = () => {
  const [loading, setLoading] = useState(true);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [summary, setSummary] = useState<FeeSummary>({
    totalFees: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0
  });
  
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    const fetchFeeData = async () => {
      try {
        const response = await studentApi.getFeeStatus();
        
        if (response.error) {
          toast({
            title: "Error",
            description: response.error,
            variant: "destructive",
          });
          return;
        }
        
        if (response.data) {
          setFeeItems(response.data.items || []);
          setSummary(response.data.summary || {
            totalFees: 0,
            totalPaid: 0,
            totalPending: 0,
            totalOverdue: 0
          });
        }
      } catch (error) {
        console.error("Failed to fetch fee data:", error);
        toast({
          title: "Error",
          description: "Failed to fetch fee data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    // Mock data for demonstration
    setTimeout(() => {
      const mockFeeItems: FeeItem[] = [
        {
          id: "tui-spring2024",
          description: "Tuition Fee - Spring 2024",
          amount: 5000,
          dueDate: "2024-01-15",
          status: "paid",
          paidDate: "2024-01-10",
          paymentMethod: "Credit Card",
          receiptNumber: "REC-23456"
        },
        {
          id: "lib-spring2024",
          description: "Library Fee - Spring 2024",
          amount: 200,
          dueDate: "2024-01-15",
          status: "paid",
          paidDate: "2024-01-10",
          paymentMethod: "Credit Card",
          receiptNumber: "REC-23456"
        },
        {
          id: "tui-fall2024",
          description: "Tuition Fee - Fall 2024",
          amount: 5000,
          dueDate: "2024-08-15",
          status: "pending"
        },
        {
          id: "lib-fall2024",
          description: "Library Fee - Fall 2024",
          amount: 200,
          dueDate: "2024-08-15",
          status: "pending"
        },
        {
          id: "exam-spring2024",
          description: "Examination Fee - Spring 2024",
          amount: 300,
          dueDate: "2024-05-10",
          status: "overdue"
        }
      ];
      
      const mockSummary: FeeSummary = {
        totalFees: 10700,
        totalPaid: 5200,
        totalPending: 5200,
        totalOverdue: 300
      };
      
      setFeeItems(mockFeeItems);
      setSummary(mockSummary);
      setLoading(false);
    }, 1000);
    
    // Uncomment to use real API
    // fetchFeeData();
  }, []);

  const handlePayment = () => {
    if (!paymentAmount || !paymentMethod) {
      toast({
        title: "Error",
        description: "Please enter a payment amount and select a payment method.",
        variant: "destructive",
      });
      return;
    }
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }
    
    // In a real app, this would make a payment API call
    setProcessingPayment(true);
    
    setTimeout(() => {
      toast({
        title: "Payment Successful",
        description: `Your payment of $${amount.toFixed(2)} has been processed successfully.`,
      });
      setProcessingPayment(false);
      setPaymentAmount("");
    }, 2000);
  };

  const downloadReceipt = (receiptNumber: string) => {
    toast({
      title: "Download Started",
      description: `Receipt ${receiptNumber} is being downloaded...`,
    });
  };

  return (
    <DashboardLayout userType="student">
      <h1 className="page-title">Fee Payment</h1>
      
      {loading ? (
        <div className="text-center py-12">Loading fee information...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalFees.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Academic Year 2024-2025</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center">
                  <Check className="mr-1 h-4 w-4" /> Paid Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  ${summary.totalPaid.toFixed(2)}
                </div>
                <p className="text-xs text-green-600/70 dark:text-green-400/70">
                  {((summary.totalPaid / summary.totalFees) * 100).toFixed(0)}% of total fees
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center">
                  <Clock className="mr-1 h-4 w-4" /> Pending Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  ${summary.totalPending.toFixed(2)}
                </div>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  Due in upcoming semesters
                </p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center">
                  <AlertCircle className="mr-1 h-4 w-4" /> Overdue Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  ${summary.totalOverdue.toFixed(2)}
                </div>
                <p className="text-xs text-red-600/70 dark:text-red-400/70">
                  Please pay immediately
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Fee Details */}
          <Tabs defaultValue="all">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="all" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Fee Details</CardTitle>
                  <CardDescription>Complete list of your fees and payments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Description</th>
                          <th className="text-left py-3 px-2">Amount</th>
                          <th className="text-left py-3 px-2">Due Date</th>
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-left py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeItems.map((item) => (
                          <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-2">{item.description}</td>
                            <td className="py-3 px-2 font-medium">${item.amount.toFixed(2)}</td>
                            <td className="py-3 px-2">
                              <div className="flex items-center">
                                <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                                {new Date(item.dueDate).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                item.status === 'paid' 
                                  ? 'bg-green-100 text-green-700' 
                                  : item.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              {item.status === 'paid' ? (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => item.receiptNumber && downloadReceipt(item.receiptNumber)}
                                >
                                  <Download className="mr-1 h-3 w-3" /> Receipt
                                </Button>
                              ) : (
                                <Button 
                                  size="sm"
                                  variant={item.status === 'overdue' ? "destructive" : "outline"}
                                >
                                  Pay Now
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="paid" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Description</th>
                          <th className="text-left py-3 px-2">Amount</th>
                          <th className="text-left py-3 px-2">Paid Date</th>
                          <th className="text-left py-3 px-2">Method</th>
                          <th className="text-left py-3 px-2">Receipt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeItems
                          .filter(item => item.status === 'paid')
                          .map((item) => (
                            <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-3 px-2">{item.description}</td>
                              <td className="py-3 px-2 font-medium">${item.amount.toFixed(2)}</td>
                              <td className="py-3 px-2">{item.paidDate && new Date(item.paidDate).toLocaleDateString()}</td>
                              <td className="py-3 px-2">{item.paymentMethod}</td>
                              <td className="py-3 px-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => item.receiptNumber && downloadReceipt(item.receiptNumber)}
                                >
                                  <Download className="mr-1 h-3 w-3" /> Receipt
                                </Button>
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="pending" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Description</th>
                          <th className="text-left py-3 px-2">Amount</th>
                          <th className="text-left py-3 px-2">Due Date</th>
                          <th className="text-left py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeItems
                          .filter(item => item.status === 'pending')
                          .map((item) => (
                            <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                              <td className="py-3 px-2">{item.description}</td>
                              <td className="py-3 px-2 font-medium">${item.amount.toFixed(2)}</td>
                              <td className="py-3 px-2">
                                <div className="flex items-center">
                                  <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="py-3 px-2">
                                <Button size="sm" variant="outline">
                                  Pay Now
                                </Button>
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="overdue" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Description</th>
                          <th className="text-left py-3 px-2">Amount</th>
                          <th className="text-left py-3 px-2">Due Date</th>
                          <th className="text-left py-3 px-2">Days Overdue</th>
                          <th className="text-left py-3 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeItems
                          .filter(item => item.status === 'overdue')
                          .map((item) => {
                            const dueDate = new Date(item.dueDate);
                            const today = new Date();
                            const daysOverdue = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                            
                            return (
                              <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="py-3 px-2">{item.description}</td>
                                <td className="py-3 px-2 font-medium">${item.amount.toFixed(2)}</td>
                                <td className="py-3 px-2">
                                  {new Date(item.dueDate).toLocaleDateString()}
                                </td>
                                <td className="py-3 px-2 text-red-600">{daysOverdue} days</td>
                                <td className="py-3 px-2">
                                  <Button size="sm" variant="destructive">
                                    Pay Now
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Make a Payment Section */}
          <Card>
            <CardHeader>
              <CardTitle>Make a Payment</CardTitle>
              <CardDescription>Pay your fees online using various payment methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Payment Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        placeholder="0.00"
                        value={paymentAmount} 
                        onChange={(e) => setPaymentAmount(e.target.value)} 
                        className="pl-7"
                      />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Payment Method</label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Payment Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Pending Fees</span>
                      <span>${(summary.totalPending + summary.totalOverdue).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Amount</span>
                      <span>${paymentAmount ? parseFloat(paymentAmount).toFixed(2) : "0.00"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Fee</span>
                      <span>$0.00</span>
                    </div>
                    <div className="border-t pt-2 mt-2 font-medium flex justify-between">
                      <span>Total</span>
                      <span>${paymentAmount ? parseFloat(paymentAmount).toFixed(2) : "0.00"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button disabled={processingPayment} onClick={handlePayment} className="w-full sm:w-auto">
                {processingPayment ? (
                  "Processing Payment..."
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Make Payment
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default FeePayment;
