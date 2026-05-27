import React, { useState } from "react";
import {
  NAsyncCard,
  NDetailCard,
  NDetailItem,
  NDetailList,
  NStatCard,
  NAvatarItem,
  NStatusBadge,
  Button,
} from "najm-ui";
import { Users, TrendingUp, DollarSign, ShoppingCart, Mail, Phone, MapPin, Building } from "lucide-react";

export default function DataDisplayPreview() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Data Display</h2>

      {/* NStatCard */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">NStatCard</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NStatCard
            label="Total Revenue"
            value="$45,231"
            description="Last 30 days"
            icon={DollarSign}
            trend={{ value: 20.1, direction: "up", label: "vs last month" }}
          />
          <NStatCard
            label="Active Users"
            value="2,350"
            icon={Users}
            trend={{ value: 5.2, direction: "up" }}
          />
          <NStatCard
            label="Orders"
            value="1,234"
            icon={ShoppingCart}
            trend={{ value: 3.1, direction: "down", label: "vs last week" }}
          />
          <NStatCard
            label="Conversion"
            value="3.2%"
            icon={TrendingUp}
            trend={{ value: 0, direction: "neutral" }}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NStatCard
            label="Loading State"
            value=""
            loading
          />
          <NStatCard
            label="Custom Render"
            value={42}
            renderValue={(v) => <span className="text-primary">{v} items</span>}
          />
        </div>
      </section>

      {/* NAsyncCard */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">NAsyncCard</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NAsyncCard title="Normal Card" icon={Users} description="A card with content">
            <p className="text-sm text-muted-foreground">This is the card body content.</p>
          </NAsyncCard>
          <NAsyncCard title="With Action" headerAction={<Button size="sm" variant="outline">View All</Button>}>
            <p className="text-sm text-muted-foreground">Card with a header action button.</p>
          </NAsyncCard>
          <NAsyncCard title="Loading" loading loadingText="Fetching data..." />
          <NAsyncCard title="Error State" error="Failed to load data" onRetry={() => {}} />
          <NAsyncCard title="Empty State" empty emptyText="No records found" />
          <NAsyncCard title="With Footer" footer={<div className="text-xs text-muted-foreground">Last updated: 2 min ago</div>}>
            <p className="text-sm text-muted-foreground">Card with footer content.</p>
          </NAsyncCard>
        </div>
      </section>

      {/* NDetailCard */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">NDetailCard</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NDetailCard title="Contact Info" icon={Mail} description="Primary contact details">
            <div className="space-y-2">
              <NDetailItem icon={Mail} label="Email" value="john@example.com" />
              <NDetailItem icon={Phone} label="Phone" value="+1 234 567 890" />
              <NDetailItem icon={MapPin} label="Location" value="New York, NY, United States" maxChars={15} />
            </div>
          </NDetailCard>
          <NDetailCard
            title="Company Details"
            icon={Building}
            action={<Button size="sm" variant="ghost">Edit</Button>}
          >
            <NDetailList
              items={[
                { icon: Building, label: "Company", value: "Acme Corporation International" },
                { icon: Users, label: "Employees", value: "250+" },
                { icon: MapPin, label: "HQ", value: "San Francisco, CA" },
              ]}
            />
          </NDetailCard>
        </div>
      </section>

      {/* NAvatarItem */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">NAvatarItem</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 border rounded-lg">
            <NAvatarItem title="Alice Johnson" subtitle="alice@example.com" />
            <NAvatarItem title="Bob Smith" subtitle="Product Designer" meta="Engineering" />
            <NAvatarItem title="Charlie Brown" subtitle="CEO" size="lg" />
          </div>
          <div className="space-y-3 p-4 border rounded-lg">
            <NAvatarItem title="Diana Prince" subtitle="Admin" size="sm" />
            <NAvatarItem title="Eve Wilson" subtitle="Developer" meta="Remote" />
            <NAvatarItem src="https://via.placeholder.com/150" title="With Image" subtitle="Has avatar image" />
          </div>
        </div>
      </section>

      {/* NStatusBadge */}
      <section className="space-y-3">
        <h3 className="text-md font-medium">NStatusBadge</h3>
        <div className="flex flex-wrap gap-2">
          <NStatusBadge status="active" showIcon />
          <NStatusBadge status="pending" variant="outline" showIcon />
          <NStatusBadge status="cancelled" variant="canvas" showIcon />
          <NStatusBadge theme="success" variant="minimal" showIcon>Success</NStatusBadge>
          <NStatusBadge theme="danger" variant="text" showIcon>Deleted</NStatusBadge>
        </div>
      </section>

      <div className="pt-4 border-t">
        <Button variant="outline" onClick={() => setLoading(!loading)}>
          Toggle Loading: {loading ? "ON" : "OFF"}
        </Button>
      </div>
    </div>
  );
}
