import type { Schema, Struct } from '@strapi/strapi';

export interface ProductDimensions extends Struct.ComponentSchema {
  collectionName: 'components_product_dimensions';
  info: {
    description: 'Product dimensions and weight';
    displayName: 'Dimensions';
  };
  attributes: {
    diameter: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    height: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    length: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    unit: Schema.Attribute.Enumeration<['cm', 'mm', 'm', 'in']> &
      Schema.Attribute.DefaultTo<'cm'>;
    weight: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    weight_unit: Schema.Attribute.Enumeration<['g', 'kg', 'oz', 'lb']> &
      Schema.Attribute.DefaultTo<'g'>;
    width: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ProductImprintPosition extends Struct.ComponentSchema {
  collectionName: 'components_product_imprint_positions';
  info: {
    description: 'Product customization and imprint positions';
    displayName: 'Imprint Position';
  };
  attributes: {
    ean: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
    is_active: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    max_colors: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<1>;
    max_dimensions: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    position_code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 50;
      }>;
    position_name: Schema.Attribute.JSON & Schema.Attribute.Required;
    print_costs: Schema.Attribute.JSON;
    print_technique: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 100;
      }>;
    setup_costs: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

export interface ProductPriceTier extends Struct.ComponentSchema {
  collectionName: 'components_product_price_tiers';
  info: {
    description: 'Quantity-based pricing tiers';
    displayName: 'Price Tier';
  };
  attributes: {
    buying_price: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    country_code: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 5;
      }>;
    currency: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 3;
      }> &
      Schema.Attribute.DefaultTo<'EUR'>;
    price: Schema.Attribute.Decimal &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    price_type: Schema.Attribute.Enumeration<
      ['selling', 'buying', 'recommended']
    > &
      Schema.Attribute.DefaultTo<'selling'>;
    quantity: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    region: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 20;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'product.dimensions': ProductDimensions;
      'product.imprint-position': ProductImprintPosition;
      'product.price-tier': ProductPriceTier;
    }
  }
}
