<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Lang;

class VerifyRegistration extends Notification
{
    use Queueable;

    public $verificationUrl;

    public function __construct($verificationUrl)
    {
        $this->verificationUrl = $verificationUrl;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject(Lang::get('Verify Your Email Address for AutoVet'))
            ->line(Lang::get('Thank you for registering! Please click the button below to verify your email address and complete your registration.'))
            ->action(Lang::get('Verify Email Address'), $this->verificationUrl)
            ->line(Lang::get('This is the email verification logic to login after you register.'))
            ->line(Lang::get('If you did not create an account, no further action is required.'));
    }

    public function toArray($notifiable)
    {
        return [
            //
        ];
    }
}
