
export type OrderStatus =
  | "Processing"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

export type DashboardMetric = "Revenue" | "Orders" | "Customers";
export type DashboardPeriod = 7 | 14 | 30;

export type DemoProduct = {
  name: string;
  image: string;
};

export type DashboardOrder = {
  id: string;
  customer: string;
  email: string;
  initials: string;
  avatarColor: string;
  products: DemoProduct[];
  total: string;
  status: OrderStatus;
  date: string;
  time: string;
};

export const dashboardStats = [
  {
    title: "Total Revenue",
    value: "MAD 245,890",
    growth: "+18.2%",
    color: "green",
    points: [12, 18, 17, 27, 23, 33, 38],
  },
  {
    title: "Total Orders",
    value: "1,248",
    growth: "+12.5%",
    color: "purple",
    points: [10, 20, 15, 26, 23, 35, 40],
  },
  {
    title: "Total Customers",
    value: "892",
    growth: "+8.1%",
    color: "orange",
    points: [10, 13, 23, 21, 34, 29, 39],
  },
  {
    title: "Total Products",
    value: "356",
    growth: "+4.3%",
    color: "blue",
    points: [10, 19, 16, 28, 24, 35, 40],
  },
] as const;

export const salesData = [
  22, 32, 29, 42, 36, 49, 44, 56,
  48, 42, 50, 61, 55, 65, 58, 72,
  67, 82, 78, 69, 65, 74, 71, 83,
  77, 91, 88, 98, 92, 105, 95,
];

export const previousSalesData = [
  18, 24, 29, 27, 31, 32, 38, 34,
  40, 42, 36, 44, 47, 43, 53, 51,
  55, 54, 58, 56, 62, 59, 64, 62,
  70, 72, 68, 74, 75, 80, 78,
];

export const categories = [
  { name: "Electronics", value: 35, color: "#4778F5" },
  { name: "Clothing", value: 24, color: "#9270F5" },
  { name: "Home & Living", value: 14, color: "#25C48A" },
  { name: "Beauty", value: 10, color: "#FFC35A" },
  { name: "Sports", value: 8, color: "#FF7889" },
  { name: "Accessories", value: 5, color: "#F5A0C4" },
  { name: "Others", value: 4, color: "#CBD3E8" },
] as const;

export const demoProducts = {
  headphones: {
    name: "Wireless Headphones",
    image: "/demo/products/headphones.jpg",
  },
  tshirt: {
    name: "Classic T-Shirt",
    image: "/demo/products/tshirt.jpg",
  },
  watch: {
    name: "Smart Watch",
    image: "/demo/products/watch.jpg",
  },
  shoes: {
    name: "Running Shoes",
    image: "/demo/products/shoes.jpg",
  },
  backpack: {
    name: "Leather Backpack",
    image: "/demo/products/backpack.jpg",
  },
} satisfies Record<string, DemoProduct>;

export const recentOrders: DashboardOrder[] = [
  {
    id: "#1028",
    customer: "Sarah El Idrissi",
    email: "sarah@example.com",
    initials: "SE",
    avatarColor: "bg-violet-100 text-violet-700",
    products: [demoProducts.tshirt, demoProducts.backpack],
    total: "MAD 1,299",
    status: "Processing",
    date: "Oct 21, 2026",
    time: "10:24 AM",
  },
  {
    id: "#1027",
    customer: "Ahmed Benali",
    email: "ahmed@example.com",
    initials: "AB",
    avatarColor: "bg-blue-100 text-blue-700",
    products: [demoProducts.tshirt, demoProducts.shoes],
    total: "MAD 890",
    status: "Shipped",
    date: "Oct 21, 2026",
    time: "09:15 AM",
  },
  {
    id: "#1026",
    customer: "Youssef Amrani",
    email: "youssef@example.com",
    initials: "YA",
    avatarColor: "bg-emerald-100 text-emerald-700",
    products: [demoProducts.watch, demoProducts.shoes],
    total: "MAD 2,450",
    status: "Delivered",
    date: "Oct 20, 2026",
    time: "08:45 PM",
  },
  {
    id: "#1025",
    customer: "Fatima Zahra",
    email: "fatima@example.com",
    initials: "FZ",
    avatarColor: "bg-orange-100 text-orange-700",
    products: [demoProducts.backpack, demoProducts.tshirt],
    total: "MAD 679",
    status: "Processing",
    date: "Oct 20, 2026",
    time: "02:30 PM",
  },
  {
    id: "#1024",
    customer: "Omar Haddad",
    email: "omar@example.com",
    initials: "OH",
    avatarColor: "bg-pink-100 text-pink-700",
    products: [demoProducts.headphones, demoProducts.watch],
    total: "MAD 1,785",
    status: "Cancelled",
    date: "Oct 19, 2026",
    time: "11:20 AM",
  },
];
