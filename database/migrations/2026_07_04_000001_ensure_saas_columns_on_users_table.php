<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('plans')) {
            Schema::create('plans', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100)->unique();
                $table->float('price', 30, 2)->default(0);
                $table->float('yearly_price', 30, 2)->nullable();
                $table->string('duration', 100)->default('monthly');
                $table->integer('max_users')->default(0);
                $table->integer('max_employees')->default(0);
                $table->text('description')->nullable();
                $table->string('enable_chatgpt', 255)->default('on');
                $table->float('storage_limit', 15, 2)->default(0.00);
                $table->string('is_trial')->nullable();
                $table->integer('trial_day')->default(0);
                $table->string('is_plan_enable')->default('on');
                $table->boolean('is_default')->default(false);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('coupons')) {
            Schema::create('coupons', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->enum('type', ['percentage', 'flat']);
                $table->decimal('minimum_spend', 10, 2)->nullable();
                $table->decimal('maximum_spend', 10, 2)->nullable();
                $table->decimal('discount_amount', 10, 2);
                $table->integer('use_limit_per_coupon')->nullable();
                $table->integer('use_limit_per_user')->nullable();
                $table->date('expiry_date')->nullable();
                $table->string('code')->unique();
                $table->enum('code_type', ['manual', 'auto'])->default('manual');
                $table->boolean('status')->default(true);
                $table->unsignedBigInteger('created_by');
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('users')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'plan_id')) {
                $table->unsignedBigInteger('plan_id')->nullable();
            }

            if (!Schema::hasColumn('users', 'plan_expire_date')) {
                $table->date('plan_expire_date')->nullable();
            }

            if (!Schema::hasColumn('users', 'requested_plan')) {
                $table->integer('requested_plan')->default(0);
            }

            if (!Schema::hasColumn('users', 'plan_is_active')) {
                $table->integer('plan_is_active')->default(1);
            }

            if (!Schema::hasColumn('users', 'storage_limit')) {
                $table->float('storage_limit', 15, 2)->default(0.00);
            }

            if (!Schema::hasColumn('users', 'is_trial')) {
                $table->string('is_trial')->nullable();
            }

            if (!Schema::hasColumn('users', 'trial_day')) {
                $table->integer('trial_day')->default(0);
            }

            if (!Schema::hasColumn('users', 'trial_expire_date')) {
                $table->date('trial_expire_date')->nullable();
            }

            if (!Schema::hasColumn('users', 'active_module')) {
                $table->text('active_module')->nullable();
            }

            if (!Schema::hasColumn('users', 'referral_code')) {
                $table->string('referral_code')->nullable();
            }

            if (!Schema::hasColumn('users', 'used_referral_code')) {
                $table->string('used_referral_code')->nullable();
            }

            if (!Schema::hasColumn('users', 'commission_amount')) {
                $table->integer('commission_amount')->default(0);
            }
        });

        if (!Schema::hasTable('plan_orders')) {
            Schema::create('plan_orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('plan_id');
                $table->unsignedBigInteger('coupon_id')->nullable();
                $table->string('billing_cycle')->nullable();
                $table->string('order_number')->unique();
                $table->decimal('original_price', 10, 2);
                $table->decimal('discount_amount', 10, 2)->default(0);
                $table->decimal('final_price', 10, 2);
                $table->string('coupon_code')->nullable();
                $table->string('payment_method')->nullable();
                $table->text('payment_id')->nullable();
                $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
                $table->timestamp('ordered_at');
                $table->timestamp('processed_at')->nullable();
                $table->unsignedBigInteger('processed_by')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('plan_requests')) {
            Schema::create('plan_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('plan_id');
                $table->string('status')->default('pending');
                $table->text('message')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->timestamp('rejected_at')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->unsignedBigInteger('rejected_by')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('referral_settings')) {
            Schema::create('referral_settings', function (Blueprint $table) {
                $table->id();
                $table->boolean('is_enabled')->default(true);
                $table->decimal('commission_percentage', 5, 2)->default(10.00);
                $table->decimal('threshold_amount', 10, 2)->default(50.00);
                $table->text('guidelines')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('referrals')) {
            Schema::create('referrals', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('company_id');
                $table->decimal('commission_percentage', 5, 2);
                $table->decimal('amount', 10, 2);
                $table->unsignedBigInteger('plan_id')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('payout_requests')) {
            Schema::create('payout_requests', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                $table->decimal('amount', 10, 2);
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (Schema::hasTable('plans') && DB::table('plans')->count() === 0) {
            DB::table('plans')->insert([
                [
                    'name' => 'Free',
                    'price' => 0,
                    'yearly_price' => 0,
                    'duration' => 'monthly',
                    'description' => 'Basic plan for small businesses just getting started.',
                    'max_users' => 2,
                    'max_employees' => 5,
                    'enable_chatgpt' => 'off',
                    'storage_limit' => 1,
                    'is_trial' => null,
                    'trial_day' => 0,
                    'is_plan_enable' => 'on',
                    'is_default' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'name' => 'Starter',
                    'price' => 19.99,
                    'yearly_price' => 191.90,
                    'duration' => 'monthly',
                    'description' => 'Perfect for small businesses looking to grow.',
                    'max_users' => 10,
                    'max_employees' => 25,
                    'enable_chatgpt' => 'off',
                    'storage_limit' => 5,
                    'is_trial' => 'on',
                    'trial_day' => 7,
                    'is_plan_enable' => 'on',
                    'is_default' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'name' => 'Pro',
                    'price' => 49.99,
                    'yearly_price' => 479.90,
                    'duration' => 'monthly',
                    'description' => 'Ideal for growing businesses with advanced needs.',
                    'max_users' => 50,
                    'max_employees' => 100,
                    'enable_chatgpt' => 'on',
                    'storage_limit' => 50,
                    'is_trial' => 'on',
                    'trial_day' => 14,
                    'is_plan_enable' => 'on',
                    'is_default' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }

        if (Schema::hasTable('referral_settings') && DB::table('referral_settings')->count() === 0) {
            DB::table('referral_settings')->insert([
                'is_enabled' => true,
                'commission_percentage' => 10.00,
                'threshold_amount' => 50.00,
                'guidelines' => 'Welcome to our referral program! Earn commission when users sign up using your referral link and purchase a plan.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Intentionally left blank. This migration repairs missing production columns,
        // so rollback should not risk dropping existing user subscription data.
    }
};
