import { type Category } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryTabsProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategorySelect: (categoryId: string | null) => void;
  isLoading: boolean;
}

export default function CategoryTabs({ categories, selectedCategory, onCategorySelect, isLoading }: CategoryTabsProps) {
  if (isLoading) {
    return (
      <div className="flex overflow-x-auto space-x-2 mb-6 pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-full flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto space-x-2 mb-6 pb-2">
      <Button
        className={`rounded-full whitespace-nowrap font-semibold ${
          selectedCategory === null ? 'bg-primary text-primary-foreground' : 'bg-white border border-border hover:bg-muted'
        }`}
        onClick={() => onCategorySelect(null)}
        data-testid="button-category-all"
      >
        🔥 Flash Sale
      </Button>
      
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={selectedCategory === category.id ? "default" : "outline"}
          className="rounded-full whitespace-nowrap"
          onClick={() => onCategorySelect(category.id)}
          data-testid={`button-category-${category.id}`}
        >
          {category.emoji} {category.name}
        </Button>
      ))}
    </div>
  );
}
