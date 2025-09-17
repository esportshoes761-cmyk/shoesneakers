import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { getBrandLogoType } from "@/lib/brand-utils";
import { type Category, type BrandWithProducts } from "@shared/schema";

export interface SearchFilters {
  query: string;
  priceMin: number;
  priceMax: number;
  brands: string[];
  categories: string[];
  sizes: string[];
  colors: string[];
  onSale: boolean;
  inStock: boolean;
}

interface AdvancedSearchProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  categories: Category[];
  brands: BrandWithProducts[];
  onClear: () => void;
}

const commonSizes = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];
const commonColors = ["Negro", "Blanco", "Marrón", "Azul", "Rojo", "Verde", "Gris", "Beige", "Rosa", "Amarillo"];

export default function AdvancedSearch({ 
  filters, 
  onFiltersChange, 
  categories, 
  brands, 
  onClear 
}: AdvancedSearchProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isPriceOpen, setIsPriceOpen] = useState(false);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSizeOpen, setIsSizeOpen] = useState(false);
  const [isColorOpen, setIsColorOpen] = useState(false);

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleBrand = (brandId: string) => {
    const newBrands = filters.brands.includes(brandId)
      ? filters.brands.filter(b => b !== brandId)
      : [...filters.brands, brandId];
    updateFilters({ brands: newBrands });
  };

  const toggleCategory = (categoryName: string) => {
    const newCategories = filters.categories.includes(categoryName)
      ? filters.categories.filter(c => c !== categoryName)
      : [...filters.categories, categoryName];
    updateFilters({ categories: newCategories });
  };

  const toggleSize = (size: string) => {
    const newSizes = filters.sizes.includes(size)
      ? filters.sizes.filter(s => s !== size)
      : [...filters.sizes, size];
    updateFilters({ sizes: newSizes });
  };

  const toggleColor = (color: string) => {
    const newColors = filters.colors.includes(color)
      ? filters.colors.filter(c => c !== color)
      : [...filters.colors, color];
    updateFilters({ colors: newColors });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.brands.length > 0) count++;
    if (filters.categories.length > 0) count++;
    if (filters.sizes.length > 0) count++;
    if (filters.colors.length > 0) count++;
    if (filters.onSale) count++;
    if (filters.inStock) count++;
    if (filters.priceMin > 0 || filters.priceMax < 1000000) count++;
    return count;
  };

  return (
    <div className="bg-card border border-border rounded-lg sm:rounded-xl p-3 sm:p-6 mb-4 sm:mb-6">
      {/* Search Input */}
      <div className="relative mb-3 sm:mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar zapatos, marcas, modelos..."
          value={filters.query}
          onChange={(e) => updateFilters({ query: e.target.value })}
          className="pl-10 h-10 sm:h-12 text-sm sm:text-base"
          data-testid="input-search-query"
        />
      </div>

      {/* Filter Toggle Button */}
      <div className="flex justify-between items-center mb-3">
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="flex items-center gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4" />
              <span>Filtros</span>
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFiltersCount()}
                </Badge>
              )}
              {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 space-y-4">
            {/* Quick Options */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="onSale"
                  checked={filters.onSale}
                  onCheckedChange={(checked) => updateFilters({ onSale: checked as boolean })}
                  data-testid="checkbox-on-sale"
                />
                <Label htmlFor="onSale" className="text-sm">En oferta</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="inStock"
                  checked={filters.inStock}
                  onCheckedChange={(checked) => updateFilters({ inStock: checked as boolean })}
                  data-testid="checkbox-in-stock"
                />
                <Label htmlFor="inStock" className="text-sm">Disponible</Label>
              </div>
            </div>

            {/* Price Range Filter */}
            <Collapsible open={isPriceOpen} onOpenChange={setIsPriceOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="font-medium">Rango de precio</span>
                  {isPriceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 border rounded-lg mt-2">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Mínimo</Label>
                      <div className="text-sm font-medium">{formatCurrency(filters.priceMin)}</div>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Máximo</Label>
                      <div className="text-sm font-medium">{formatCurrency(filters.priceMax)}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Precio mínimo</Label>
                    <Slider
                      value={[filters.priceMin]}
                      onValueChange={([value]) => updateFilters({ priceMin: value })}
                      max={500000}
                      step={10000}
                      className="w-full"
                      data-testid="slider-price-min"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Precio máximo</Label>
                    <Slider
                      value={[filters.priceMax]}
                      onValueChange={([value]) => updateFilters({ priceMax: value })}
                      max={1000000}
                      step={10000}
                      className="w-full"
                      data-testid="slider-price-max"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Brand Filter */}
            <Collapsible open={isBrandOpen} onOpenChange={setIsBrandOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="font-medium">
                    Marcas {filters.brands.length > 0 && `(${filters.brands.length})`}
                  </span>
                  {isBrandOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 border rounded-lg mt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {brands.map((brand) => (
                    <div key={brand.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`brand-${brand.id}`}
                        checked={filters.brands.includes(brand.id)}
                        onCheckedChange={() => toggleBrand(brand.id)}
                        data-testid={`checkbox-brand-${brand.id}`}
                      />
                      <Label htmlFor={`brand-${brand.id}`} className="text-sm flex items-center gap-2">
                        {getBrandLogoType(brand.logo) === 'emoji' ? (
                          <span className="w-4 h-4 flex items-center justify-center text-sm">
                            {brand.logo}
                          </span>
                        ) : getBrandLogoType(brand.logo) === 'image' ? (
                          <img src={brand.logo} alt={brand.name} className="w-4 h-4 object-contain" />
                        ) : (
                          <span className="w-4 h-4 bg-muted rounded flex items-center justify-center text-xs font-bold">
                            {brand.name.charAt(0)}
                          </span>
                        )}
                        {brand.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Category Filter */}
            <Collapsible open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="font-medium">
                    Categorías {filters.categories.length > 0 && `(${filters.categories.length})`}
                  </span>
                  {isCategoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 border rounded-lg mt-2">
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <div key={category.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.name}`}
                        checked={filters.categories.includes(category.name)}
                        onCheckedChange={() => toggleCategory(category.name)}
                        data-testid={`checkbox-category-${category.name}`}
                      />
                      <Label htmlFor={`category-${category.name}`} className="text-sm flex items-center gap-1">
                        <span>{category.emoji}</span>
                        {category.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Size Filter */}
            <Collapsible open={isSizeOpen} onOpenChange={setIsSizeOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="font-medium">
                    Tallas {filters.sizes.length > 0 && `(${filters.sizes.length})`}
                  </span>
                  {isSizeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 border rounded-lg mt-2">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {commonSizes.map((size) => (
                    <Button
                      key={size}
                      variant={filters.sizes.includes(size) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSize(size)}
                      className="h-8"
                      data-testid={`button-size-${size}`}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Color Filter */}
            <Collapsible open={isColorOpen} onOpenChange={setIsColorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="font-medium">
                    Colores {filters.colors.length > 0 && `(${filters.colors.length})`}
                  </span>
                  {isColorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 border rounded-lg mt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {commonColors.map((color) => (
                    <Button
                      key={color}
                      variant={filters.colors.includes(color) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleColor(color)}
                      className="h-8 text-xs"
                      data-testid={`button-color-${color}`}
                    >
                      {color}
                    </Button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CollapsibleContent>
        </Collapsible>

        {/* Clear Filters Button */}
        {getActiveFiltersCount() > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClear}
            className="ml-2"
            data-testid="button-clear-filters"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {getActiveFiltersCount() > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
          {filters.brands.map((brandId) => {
            const brand = brands.find(b => b.id === brandId);
            return brand ? (
              <Badge key={brandId} variant="secondary" className="flex items-center gap-1">
                {getBrandLogoType(brand.logo) === 'emoji' ? (
                  <span className="w-3 h-3 flex items-center justify-center text-xs">
                    {brand.logo}
                  </span>
                ) : getBrandLogoType(brand.logo) === 'image' ? (
                  <img src={brand.logo} alt={brand.name} className="w-3 h-3 object-contain" />
                ) : (
                  <span className="w-3 h-3 bg-muted rounded flex items-center justify-center text-xs font-bold">
                    {brand.name.charAt(0)}
                  </span>
                )}
                {brand.name}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => toggleBrand(brandId)}
                />
              </Badge>
            ) : null;
          })}
          {filters.categories.map((categoryName) => (
            <Badge key={categoryName} variant="secondary" className="flex items-center gap-1">
              {categoryName}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleCategory(categoryName)}
              />
            </Badge>
          ))}
          {filters.sizes.map((size) => (
            <Badge key={size} variant="secondary" className="flex items-center gap-1">
              Talla {size}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleSize(size)}
              />
            </Badge>
          ))}
          {filters.colors.map((color) => (
            <Badge key={color} variant="secondary" className="flex items-center gap-1">
              {color}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleColor(color)}
              />
            </Badge>
          ))}
          {filters.onSale && (
            <Badge variant="secondary" className="flex items-center gap-1">
              En oferta
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilters({ onSale: false })}
              />
            </Badge>
          )}
          {filters.inStock && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Disponible
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => updateFilters({ inStock: false })}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}