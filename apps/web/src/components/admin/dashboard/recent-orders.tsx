
import Image from "next/image";

import {
  recentOrders,
  type DashboardOrder,
  type OrderStatus,
} from "./dashboard-data";

const statusStyles: Record<OrderStatus, string> = {
  Processing: "bg-amber-50 text-amber-700",
  Shipped: "bg-blue-50 text-blue-700",
  Delivered: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

function OrderStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${statusStyles[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function OrderCustomer({
  order,
}: {
  order: DashboardOrder;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${order.avatarColor}`}
      >
        {order.initials}
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-[#263658]">
          {order.customer}
        </p>
        <p className="truncate text-[10px] text-[#92A0BC]">
          {order.email}
        </p>
      </div>
    </div>
  );
}

function OrderProducts({
  order,
}: {
  order: DashboardOrder;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {order.products.map((product, index) => (
        <div
          key={`${order.id}-${product.name}-${index}`}
          title={product.name}
          className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-[#E9EDF5] bg-[#F8F9FC]"
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="40px"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}

export function RecentOrders() {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#EDF0F6] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-bold text-[#152345]">
            Recent Orders
          </h2>
          <p className="mt-1 text-[11px] text-[#92A0BC]">
            Latest store activity — demo
          </p>
        </div>

        <span className="text-xs font-medium text-[#6253F4]">
          View all soon
        </span>
      </div>

      {/* Mobile */}
      <div className="space-y-3 px-3 pb-4 md:hidden">
        {recentOrders.map((order) => (
          <article
            key={order.id}
            className="rounded-xl border border-[#EDF0F6] bg-[#FCFCFE] p-3 transition-colors hover:border-[#D6D0FF]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#6253F4]">
                {order.id}
              </span>
              <OrderStatusBadge status={order.status} />
            </div>

            <div className="mt-3">
              <OrderCustomer order={order} />
            </div>

            <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#EDF0F6] pt-3">
              <div className="min-w-0">
                <OrderProducts order={order} />
                <p className="mt-2 text-[10px] text-[#8290AB]">
                  {order.date} · {order.time}
                </p>
              </div>

              <p className="shrink-0 text-xs font-bold text-[#263658]">
                {order.total}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto px-3 pb-3 md:block sm:px-4">
        <table className="w-full min-w-[660px] border-collapse text-left">
          <thead className="bg-[#F8F9FD]">
            <tr className="text-[11px] text-[#7483A3]">
              <th scope="col" className="rounded-l-lg px-3 py-3">
                Order
              </th>
              <th scope="col" className="px-3 py-3">
                Customer
              </th>
              <th scope="col" className="px-3 py-3">
                Products
              </th>
              <th scope="col" className="px-3 py-3">
                Total
              </th>
              <th scope="col" className="px-3 py-3">
                Status
              </th>
              <th scope="col" className="rounded-r-lg px-3 py-3">
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {recentOrders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[#F0F2F8] transition-colors hover:bg-[#FAF9FF] last:border-0"
              >
                <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-[#6253F4]">
                  {order.id}
                </td>

                <td className="px-3 py-3">
                  <OrderCustomer order={order} />
                </td>

                <td className="px-3 py-3">
                  <OrderProducts order={order} />
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-[#273756]">
                  {order.total}
                </td>

                <td className="px-3 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>

                <td className="whitespace-nowrap px-3 py-3">
                  <p className="text-[11px] text-[#334569]">
                    {order.date}
                  </p>
                  <p className="mt-1 text-[10px] text-[#91A0BC]">
                    {order.time}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
