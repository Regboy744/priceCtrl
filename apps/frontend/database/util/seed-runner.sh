#!/bin/bash

# Define seed files in execution order
seeds=(
	"brands_seed.js"
	"companies_seed.js"
	"suppliers_seed.js"
	"master_products_seed.js"
	"locations_seed.js"
	"user_seed.js"
	"user_profile_seed.js"
	"supplier_products_seed.js"
	"orders_seed.js"
	"order_items_seed.js"
	"savings_calculations.seed.js"
)

echo "Starting individual seed execution..."

for seed in "${seeds[@]}"; do
	echo "Running $seed..."

	if pnpm db:seed "database/$seed"; then
		echo "✓ $seed completed successfully"

		# Add delay after user_seed.js
		if [[ "$seed" == "user_seed.js" ]]; then
			echo "Waiting 3 seconds for auth users..."
			sleep 3
		else
			sleep 2
		fi
	else
		echo "✗ Error running $seed - stopping execution"
		exit 1
	fi

	echo ""
done
